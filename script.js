// ============================================
// AI Chat Application - OpenRouter Integration
// Full-featured character card & chat system
// ============================================

// === CONFIGURATION ===
const CONFIG = {
    OPENROUTER_API_KEY: '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',
    OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
    DEFAULT_MODEL: 'meta-llama/llama-3.2-3b-instruct:free'
};

// === DEFAULT SETTINGS ===
const DEFAULT_GENERATION_SETTINGS = {
    temperature: 1.0,
    max_tokens: 2048,
    top_p: 1.0,
    top_k: 0,
    min_p: 0,
    repetition_penalty: 1.0,
    frequency_penalty: 0,
    presence_penalty: 0,
    context_size: 4096,
    stop_sequences: [],
    typical_p: 1,
    top_a: 0,
    tfs: 1,
    mirostat_mode: 0,
    mirostat_tau: 5,
    mirostat_eta: 0.1,
    stream: true
};

const DEFAULT_PRESETS = {
    default: { ...DEFAULT_GENERATION_SETTINGS },
    creative: { temperature: 1.4, top_p: 0.95, top_k: 0, repetition_penalty: 1.1 },
    precise: { temperature: 0.3, top_p: 0.9, top_k: 40, repetition_penalty: 1.0 },
    balanced: { temperature: 0.8, top_p: 0.95, top_k: 0, repetition_penalty: 1.05 }
};

const DEFAULT_PROMPT_SETTINGS = {
    systemPrompt: 'You are a helpful AI assistant engaged in a roleplay conversation. Stay in character and respond naturally.',
    useCharSystemPrompt: true,
    promptOrder: ['system', 'description', 'personality', 'scenario', 'examples', 'history'],
    authorsNote: '',
    authorsNoteDepth: 4,
    postHistory: '',
    exampleMsgMode: 'always'
};

const DEFAULT_UI_SETTINGS = {
    theme: 'dark',
    fontSize: 'medium',
    showTimestamps: true,
    autoScroll: true,
    confirmDelete: true,
    showTokenCount: true
};

// === APP STATE ===
let state = {
    models: [],
    characters: [],
    chats: [],
    currentCharacterId: null,
    currentChatId: null,
    selectedModel: '',
    generationSettings: { ...DEFAULT_GENERATION_SETTINGS },
    promptSettings: { ...DEFAULT_PROMPT_SETTINGS },
    uiSettings: { ...DEFAULT_UI_SETTINGS },
    userPersona: {
        name: 'User',
        avatar: null,
        description: ''
    },
    presets: { ...DEFAULT_PRESETS },
    isGenerating: false,
    abortController: null,
    editingCharacterId: null,
    pendingImports: []
};

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', init);

async function init() {
    // Detect iOS Safari for special styling
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
        document.body.classList.add('ios-device');
    }

    // Handle iOS Safari viewport resize (toolbar show/hide)
    if (isIOS) {
        const setViewportHeight = () => {
            document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        };
        setViewportHeight();
        window.addEventListener('resize', setViewportHeight);
    }

    loadState();
    applyUISettings();
    await loadModels();
    setupEventListeners();
    renderCharacterList();
    renderCurrentChat();
    updateUIFromState();
}

function loadState() {
    const saved = localStorage.getItem('aiChatAppState');
    if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
    }
}

function saveState() {
    const toSave = {
        characters: state.characters,
        chats: state.chats,
        currentCharacterId: state.currentCharacterId,
        currentChatId: state.currentChatId,
        selectedModel: state.selectedModel,
        generationSettings: state.generationSettings,
        promptSettings: state.promptSettings,
        uiSettings: state.uiSettings,
        userPersona: state.userPersona,
        presets: state.presets
    };
    localStorage.setItem('aiChatAppState', JSON.stringify(toSave));
}

// === MODEL LOADING ===
async function loadModels() {
    const modelSelect = document.getElementById('model-select');
    try {
        const response = await fetch(`${CONFIG.OPENROUTER_BASE_URL}/models`, {
            headers: { 'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}` }
        });
        const data = await response.json();

        state.models = data.data.filter(model => {
            return model.id.includes(':free') ||
                (model.pricing && parseFloat(model.pricing.prompt) === 0 && parseFloat(model.pricing.completion) === 0);
        }).sort((a, b) => a.name.localeCompare(b.name));

        populateModelSelect();
    } catch (error) {
        console.error('Failed to load models:', error);
        state.models = [
            { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Meta: Llama 3.2 3B Instruct (free)' },
            { id: 'meta-llama/llama-3.2-1b-instruct:free', name: 'Meta: Llama 3.2 1B Instruct (free)' },
            { id: 'google/gemma-3-4b-it:free', name: 'Google: Gemma 3 4B (free)' },
            { id: 'qwen/qwen-2.5-7b-instruct:free', name: 'Qwen: Qwen 2.5 7B (free)' },
            { id: 'mistralai/devstral-2512:free', name: 'Mistral: Devstral 2 2512 (free)' },
            { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek: R1 0528 (free)' },
        ];
        populateModelSelect();
    }
}

function populateModelSelect() {
    const modelSelect = document.getElementById('model-select');
    modelSelect.innerHTML = '<option value="">Select a model...</option>';
    state.models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelSelect.appendChild(option);
    });

    if (state.selectedModel) {
        modelSelect.value = state.selectedModel;
    }
    updateModelDisplay();
}

function updateModelDisplay() {
    const model = state.models.find(m => m.id === state.selectedModel);
    document.getElementById('current-model-name').textContent = model ? model.name : 'No model selected';
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    // Model selection
    document.getElementById('model-select').addEventListener('change', (e) => {
        state.selectedModel = e.target.value;
        updateModelDisplay();
        saveState();
    });

    // Parameter sliders
    setupParameterListeners();

    // Sidebar tabs
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
        });
    });

    // Toggle right sidebar
    document.getElementById('toggle-right-sidebar').addEventListener('click', () => {
        document.getElementById('right-sidebar').classList.toggle('collapsed');
    });

    // Mobile menu toggles
    const mobileLeftToggle = document.getElementById('mobile-left-toggle');
    const mobileRightToggle = document.getElementById('mobile-right-toggle');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const sidebarLeft = document.querySelector('.sidebar-left');
    const sidebarRight = document.getElementById('right-sidebar');

    if (mobileLeftToggle) {
        mobileLeftToggle.addEventListener('click', () => {
            sidebarLeft.classList.toggle('open');
            sidebarRight.classList.remove('open');
            mobileOverlay.classList.toggle('active', sidebarLeft.classList.contains('open'));
        });
    }

    if (mobileRightToggle) {
        mobileRightToggle.addEventListener('click', () => {
            sidebarRight.classList.toggle('open');
            sidebarLeft.classList.remove('open');
            mobileOverlay.classList.toggle('active', sidebarRight.classList.contains('open'));
        });
    }

    if (mobileOverlay) {
        mobileOverlay.addEventListener('click', () => {
            sidebarLeft.classList.remove('open');
            sidebarRight.classList.remove('open');
            mobileOverlay.classList.remove('active');
        });
    }

    // Character buttons
    document.getElementById('new-char-btn').addEventListener('click', () => openCharacterEditor());
    document.getElementById('import-char-btn').addEventListener('click', () => openModal('import-modal'));
    document.getElementById('edit-char-btn').addEventListener('click', () => {
        if (state.currentCharacterId) {
            openCharacterEditor(state.currentCharacterId);
        }
    });

    // Character search
    document.getElementById('char-search').addEventListener('input', (e) => {
        renderCharacterList(e.target.value);
    });

    // Chat buttons
    document.getElementById('new-chat-btn').addEventListener('click', createNewChat);
    document.getElementById('send-btn').addEventListener('click', sendMessage);
    document.getElementById('stop-btn').addEventListener('click', stopGeneration);
    document.getElementById('regen-btn').addEventListener('click', regenerateLastMessage);
    document.getElementById('continue-btn').addEventListener('click', continueGeneration);
    document.getElementById('impersonate-btn').addEventListener('click', impersonate);

    // Message input
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    messageInput.addEventListener('input', autoResizeTextarea);

    // Settings button
    document.getElementById('settings-btn').addEventListener('click', () => openModal('settings-modal'));

    // User persona
    document.getElementById('user-persona-btn').addEventListener('click', () => openModal('persona-modal'));

    // Character editor
    setupCharacterEditorListeners();

    // Import modal
    setupImportListeners();

    // Settings modal
    setupSettingsListeners();

    // Persona modal
    setupPersonaListeners();

    // Modal close buttons
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.dataset.modal;
            if (modalId) closeModal(modalId);
        });
    });

    // Close modals on backdrop click
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });

    // Preset buttons
    document.getElementById('preset-select').addEventListener('change', loadPreset);
    document.getElementById('save-preset-btn').addEventListener('click', () => openModal('preset-save-modal'));
    document.getElementById('confirm-save-preset-btn').addEventListener('click', saveCurrentPreset);

    // Export/clear chat
    document.getElementById('export-chat-btn').addEventListener('click', exportCurrentChat);
    document.getElementById('clear-chat-btn').addEventListener('click', clearCurrentChat);
}

function setupParameterListeners() {
    const params = [
        { slider: 'temperature', value: 'temperature-value', key: 'temperature' },
        { slider: 'max-tokens', value: 'max-tokens-value', key: 'max_tokens' },
        { slider: 'top-p', value: 'top-p-value', key: 'top_p' },
        { slider: 'top-k', value: 'top-k-value', key: 'top_k' },
        { slider: 'min-p', value: 'min-p-value', key: 'min_p' },
        { slider: 'repetition-penalty', value: 'repetition-penalty-value', key: 'repetition_penalty' },
        { slider: 'frequency-penalty', value: 'frequency-penalty-value', key: 'frequency_penalty' },
        { slider: 'presence-penalty', value: 'presence-penalty-value', key: 'presence_penalty' },
        { slider: 'context-size', value: 'context-size-value', key: 'context_size' },
        { slider: 'typical-p', value: 'typical-p-value', key: 'typical_p' },
        { slider: 'top-a', value: 'top-a-value', key: 'top_a' },
        { slider: 'tfs', value: 'tfs-value', key: 'tfs' },
        { slider: 'mirostat-tau', value: 'mirostat-tau-value', key: 'mirostat_tau' },
        { slider: 'mirostat-eta', value: 'mirostat-eta-value', key: 'mirostat_eta' }
    ];

    params.forEach(({ slider, value, key }) => {
        const sliderEl = document.getElementById(slider);
        const valueEl = document.getElementById(value);
        if (!sliderEl || !valueEl) return;

        sliderEl.addEventListener('input', () => {
            valueEl.value = sliderEl.value;
            state.generationSettings[key] = parseFloat(sliderEl.value);
            saveState();
        });

        valueEl.addEventListener('change', () => {
            sliderEl.value = valueEl.value;
            state.generationSettings[key] = parseFloat(valueEl.value);
            saveState();
        });
    });

    // Mirostat mode
    document.getElementById('mirostat-mode')?.addEventListener('change', (e) => {
        state.generationSettings.mirostat_mode = parseInt(e.target.value);
        saveState();
    });

    // Stop sequences
    document.getElementById('stop-sequences')?.addEventListener('change', (e) => {
        state.generationSettings.stop_sequences = e.target.value.split(',').map(s => s.trim()).filter(s => s);
        saveState();
    });

    // Stream toggle
    document.getElementById('stream-responses')?.addEventListener('change', (e) => {
        state.generationSettings.stream = e.target.checked;
        saveState();
    });

    // Reset buttons
    document.querySelectorAll('.reset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const param = btn.dataset.param;
            if (param && DEFAULT_GENERATION_SETTINGS[param] !== undefined) {
                state.generationSettings[param] = DEFAULT_GENERATION_SETTINGS[param];
                updateUIFromState();
                saveState();
            }
        });
    });
}

function setupCharacterEditorListeners() {
    // Editor tabs
    document.querySelectorAll('.editor-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.editorTab;
            document.querySelectorAll('.editor-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.editor-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`editor-tab-${tabName}`).classList.add('active');
        });
    });

    // Avatar upload
    document.getElementById('upload-avatar-btn').addEventListener('click', () => {
        document.getElementById('char-avatar-input').click();
    });
    document.getElementById('char-avatar-input').addEventListener('change', handleAvatarUpload);

    // Alt greetings
    document.getElementById('add-alt-greeting-btn').addEventListener('click', addAltGreeting);

    // Save/delete/export character
    document.getElementById('save-char-btn').addEventListener('click', saveCharacter);
    document.getElementById('delete-char-btn').addEventListener('click', deleteCurrentCharacter);
    document.getElementById('export-char-btn').addEventListener('click', () => {
        if (state.editingCharacterId) {
            openModal('export-modal');
        }
    });

    // Export options
    document.getElementById('export-json-btn')?.addEventListener('click', () => exportCharacterAsJSON());
    document.getElementById('export-png-btn')?.addEventListener('click', () => exportCharacterAsPNG());
}

function setupImportListeners() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('import-file-input');

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        handleImportFiles(e.dataTransfer.files);
    });

    document.getElementById('browse-files-btn').addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', () => {
        handleImportFiles(fileInput.files);
        fileInput.value = '';
    });

    document.getElementById('confirm-import-btn').addEventListener('click', confirmImport);
}

function setupSettingsListeners() {
    // Settings tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.settingsTab;
            document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.settings-tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(`settings-tab-${tabName}`).classList.add('active');
        });
    });

    // UI Settings
    document.getElementById('theme-select')?.addEventListener('change', (e) => {
        state.uiSettings.theme = e.target.value;
        applyUISettings();
        saveState();
    });

    document.getElementById('font-size-select')?.addEventListener('change', (e) => {
        state.uiSettings.fontSize = e.target.value;
        applyUISettings();
        saveState();
    });

    ['show-timestamps', 'auto-scroll', 'confirm-delete', 'show-token-count'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', (e) => {
            const key = id.replace(/-([a-z])/g, (m, c) => c.toUpperCase());
            state.uiSettings[key] = e.target.checked;
            applyUISettings();
            saveState();
        });
    });

    // Data management
    document.getElementById('export-all-btn')?.addEventListener('click', exportAllData);
    document.getElementById('import-backup-btn')?.addEventListener('click', () => {
        document.getElementById('backup-file-input').click();
    });
    document.getElementById('backup-file-input')?.addEventListener('change', importBackup);
    document.getElementById('clear-all-data-btn')?.addEventListener('click', clearAllData);
}

function setupPersonaListeners() {
    document.getElementById('upload-persona-avatar-btn').addEventListener('click', () => {
        document.getElementById('persona-avatar-input').click();
    });

    document.getElementById('persona-avatar-input').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                state.userPersona.avatar = event.target.result;
                document.getElementById('persona-avatar-preview').innerHTML = `<img src="${event.target.result}" alt="Avatar">`;
            };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('save-persona-btn').addEventListener('click', () => {
        state.userPersona.name = document.getElementById('persona-name').value || 'User';
        state.userPersona.description = document.getElementById('persona-description').value;
        saveState();
        updateUserPersonaDisplay();
        closeModal('persona-modal');
    });
}

// === CHARACTER MANAGEMENT ===
function createCharacter(data = {}) {
    const character = {
        id: generateId(),
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: {
            name: data.name || 'New Character',
            description: data.description || '',
            personality: data.personality || '',
            first_mes: data.first_mes || '',
            mes_example: data.mes_example || '',
            scenario: data.scenario || '',
            system_prompt: data.system_prompt || '',
            post_history_instructions: data.post_history_instructions || '',
            creator_notes: data.creator_notes || '',
            creator: data.creator || '',
            tags: data.tags || [],
            character_version: data.character_version || '1.0',
            alternate_greetings: data.alternate_greetings || [],
            character_book: data.character_book || { entries: [] },
            extensions: data.extensions || {}
        },
        avatar: data.avatar || null,
        createdAt: new Date().toISOString()
    };
    return character;
}

function openCharacterEditor(characterId = null) {
    state.editingCharacterId = characterId;
    const modal = document.getElementById('char-editor-modal');
    const title = document.getElementById('char-editor-title');

    if (characterId) {
        const character = state.characters.find(c => c.id === characterId);
        if (character) {
            title.textContent = 'Edit Character';
            populateCharacterEditor(character);
            document.getElementById('delete-char-btn').classList.remove('hidden');
        }
    } else {
        title.textContent = 'New Character';
        clearCharacterEditor();
        document.getElementById('delete-char-btn').classList.add('hidden');
    }

    openModal('char-editor-modal');
}

function populateCharacterEditor(character) {
    const d = character.data;
    document.getElementById('char-name').value = d.name || '';
    document.getElementById('char-creator').value = d.creator || '';
    document.getElementById('char-version').value = d.character_version || '1.0';
    document.getElementById('char-tags').value = (d.tags || []).join(', ');
    document.getElementById('char-description').value = d.description || '';
    document.getElementById('char-personality').value = d.personality || '';
    document.getElementById('char-scenario').value = d.scenario || '';
    document.getElementById('char-first-mes').value = d.first_mes || '';
    document.getElementById('char-mes-example').value = d.mes_example || '';
    document.getElementById('char-system-prompt').value = d.system_prompt || '';
    document.getElementById('char-post-history').value = d.post_history_instructions || '';
    document.getElementById('char-creator-notes').value = d.creator_notes || '';

    // Avatar
    const preview = document.getElementById('char-avatar-preview');
    if (character.avatar) {
        preview.innerHTML = `<img src="${character.avatar}" alt="Avatar">`;
    } else {
        preview.innerHTML = '<span>📷</span>';
    }

    // Alt greetings
    renderAltGreetings(d.alternate_greetings || []);
}

function clearCharacterEditor() {
    document.getElementById('char-name').value = '';
    document.getElementById('char-creator').value = '';
    document.getElementById('char-version').value = '1.0';
    document.getElementById('char-tags').value = '';
    document.getElementById('char-description').value = '';
    document.getElementById('char-personality').value = '';
    document.getElementById('char-scenario').value = '';
    document.getElementById('char-first-mes').value = '';
    document.getElementById('char-mes-example').value = '';
    document.getElementById('char-system-prompt').value = '';
    document.getElementById('char-post-history').value = '';
    document.getElementById('char-creator-notes').value = '';
    document.getElementById('char-avatar-preview').innerHTML = '<span>📷</span>';
    document.getElementById('alt-greetings-list').innerHTML = '';
}

function saveCharacter() {
    const charData = {
        name: document.getElementById('char-name').value || 'Unnamed Character',
        creator: document.getElementById('char-creator').value,
        character_version: document.getElementById('char-version').value,
        tags: document.getElementById('char-tags').value.split(',').map(t => t.trim()).filter(t => t),
        description: document.getElementById('char-description').value,
        personality: document.getElementById('char-personality').value,
        scenario: document.getElementById('char-scenario').value,
        first_mes: document.getElementById('char-first-mes').value,
        mes_example: document.getElementById('char-mes-example').value,
        system_prompt: document.getElementById('char-system-prompt').value,
        post_history_instructions: document.getElementById('char-post-history').value,
        creator_notes: document.getElementById('char-creator-notes').value,
        alternate_greetings: getAltGreetings()
    };

    // Get avatar
    const avatarImg = document.querySelector('#char-avatar-preview img');
    const avatar = avatarImg ? avatarImg.src : null;

    if (state.editingCharacterId) {
        // Update existing character
        const index = state.characters.findIndex(c => c.id === state.editingCharacterId);
        if (index !== -1) {
            state.characters[index].data = { ...state.characters[index].data, ...charData };
            state.characters[index].avatar = avatar;
        }
    } else {
        // Create new character
        const character = createCharacter({ ...charData, avatar });
        state.characters.push(character);
        state.currentCharacterId = character.id;
        createNewChat();
    }

    saveState();
    renderCharacterList();
    updateCurrentCharacterDisplay();
    closeModal('char-editor-modal');
}

function deleteCurrentCharacter() {
    if (!state.editingCharacterId) return;

    if (state.uiSettings.confirmDelete && !confirm('Are you sure you want to delete this character?')) {
        return;
    }

    state.characters = state.characters.filter(c => c.id !== state.editingCharacterId);
    state.chats = state.chats.filter(c => c.character_id !== state.editingCharacterId);

    if (state.currentCharacterId === state.editingCharacterId) {
        state.currentCharacterId = null;
        state.currentChatId = null;
    }

    saveState();
    renderCharacterList();
    renderCurrentChat();
    closeModal('char-editor-modal');
}

function handleAvatarUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            document.getElementById('char-avatar-preview').innerHTML = `<img src="${event.target.result}" alt="Avatar">`;
        };
        reader.readAsDataURL(file);
    }
}

function renderAltGreetings(greetings) {
    const container = document.getElementById('alt-greetings-list');
    container.innerHTML = '';
    greetings.forEach((greeting, index) => {
        const div = document.createElement('div');
        div.className = 'alt-greeting-item';
        div.innerHTML = `
            <textarea rows="3" data-index="${index}">${escapeHtml(greeting)}</textarea>
            <button class="remove-greeting" data-index="${index}">&times;</button>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll('.remove-greeting').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.alt-greeting-item').remove();
        });
    });
}

function addAltGreeting() {
    const container = document.getElementById('alt-greetings-list');
    const index = container.children.length;
    const div = document.createElement('div');
    div.className = 'alt-greeting-item';
    div.innerHTML = `
        <textarea rows="3" data-index="${index}" placeholder="Alternative greeting message..."></textarea>
        <button class="remove-greeting" data-index="${index}">&times;</button>
    `;
    container.appendChild(div);

    div.querySelector('.remove-greeting').addEventListener('click', () => {
        div.remove();
    });
}

function getAltGreetings() {
    const textareas = document.querySelectorAll('#alt-greetings-list textarea');
    return Array.from(textareas).map(t => t.value).filter(v => v.trim());
}

function selectCharacter(characterId) {
    state.currentCharacterId = characterId;

    // Find or create a chat for this character
    let chat = state.chats.find(c => c.character_id === characterId);
    if (!chat) {
        createNewChat();
    } else {
        state.currentChatId = chat.chat_id;
    }

    // Close mobile sidebars when selecting a character
    document.querySelector('.sidebar-left')?.classList.remove('open');
    document.getElementById('mobile-overlay')?.classList.remove('active');

    saveState();
    renderCharacterList();
    renderCurrentChat();
    updateCurrentCharacterDisplay();
    renderChatTabs();
}

function renderCharacterList(searchTerm = '') {
    const container = document.getElementById('character-list');
    const filtered = state.characters.filter(c =>
        c.data.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filtered.length === 0) {
        container.innerHTML = '<p style="padding: 20px; color: var(--text-muted); text-align: center;">No characters yet. Create one or import a character card!</p>';
        return;
    }

    container.innerHTML = filtered.map(char => `
        <div class="character-item ${char.id === state.currentCharacterId ? 'active' : ''}" data-id="${char.id}">
            <div class="char-avatar">
                ${char.avatar ? `<img src="${char.avatar}" alt="${escapeHtml(char.data.name)}">` : '🤖'}
            </div>
            <div class="char-info">
                <div class="char-name">${escapeHtml(char.data.name)}</div>
                <div class="char-preview">${escapeHtml(char.data.description?.substring(0, 50) || 'No description')}</div>
            </div>
            <div class="char-actions">
                <button class="edit-char" title="Edit">✏️</button>
            </div>
        </div>
    `).join('');

    container.querySelectorAll('.character-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.char-actions')) {
                selectCharacter(item.dataset.id);
            }
        });

        item.querySelector('.edit-char')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openCharacterEditor(item.dataset.id);
        });
    });
}

function updateCurrentCharacterDisplay() {
    const char = state.characters.find(c => c.id === state.currentCharacterId);
    const avatarEl = document.getElementById('current-char-avatar');
    const nameEl = document.getElementById('current-char-name');

    if (char) {
        nameEl.textContent = char.data.name;
        if (char.avatar) {
            avatarEl.innerHTML = `<img src="${char.avatar}" alt="${escapeHtml(char.data.name)}">`;
        } else {
            avatarEl.innerHTML = '🤖';
        }
    } else {
        nameEl.textContent = 'Select a character';
        avatarEl.innerHTML = '🤖';
    }
}

// === CHAT MANAGEMENT ===
function createNewChat() {
    if (!state.currentCharacterId) return;

    const character = state.characters.find(c => c.id === state.currentCharacterId);
    const chat = {
        chat_id: generateId(),
        character_id: state.currentCharacterId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        messages: []
    };

    // Add first message if character has one
    if (character?.data.first_mes) {
        chat.messages.push({
            id: generateId(),
            role: 'assistant',
            content: replaceMacros(character.data.first_mes, character),
            timestamp: new Date().toISOString(),
            swipes: [replaceMacros(character.data.first_mes, character)],
            current_swipe_index: 0
        });
    }

    state.chats.push(chat);
    state.currentChatId = chat.chat_id;
    saveState();
    renderChatTabs();
    renderCurrentChat();
}

function getCurrentChat() {
    return state.chats.find(c => c.chat_id === state.currentChatId);
}

function getCurrentCharacter() {
    return state.characters.find(c => c.id === state.currentCharacterId);
}

function renderChatTabs() {
    const container = document.getElementById('chat-tabs-list');
    const chats = state.chats.filter(c => c.character_id === state.currentCharacterId);

    if (chats.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = chats.map((chat, index) => `
        <div class="chat-tab ${chat.chat_id === state.currentChatId ? 'active' : ''}" data-id="${chat.chat_id}">
            <span>Chat ${index + 1}</span>
            <button class="close-tab" data-id="${chat.chat_id}">&times;</button>
        </div>
    `).join('');

    container.querySelectorAll('.chat-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            if (!e.target.classList.contains('close-tab')) {
                state.currentChatId = tab.dataset.id;
                saveState();
                renderChatTabs();
                renderCurrentChat();
            }
        });
    });

    container.querySelectorAll('.close-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteChat(btn.dataset.id);
        });
    });
}

function deleteChat(chatId) {
    if (state.uiSettings.confirmDelete && !confirm('Delete this chat?')) return;

    state.chats = state.chats.filter(c => c.chat_id !== chatId);

    if (state.currentChatId === chatId) {
        const remaining = state.chats.filter(c => c.character_id === state.currentCharacterId);
        state.currentChatId = remaining.length > 0 ? remaining[0].chat_id : null;
        if (!state.currentChatId && state.currentCharacterId) {
            createNewChat();
        }
    }

    saveState();
    renderChatTabs();
    renderCurrentChat();
}

function renderCurrentChat() {
    const container = document.getElementById('chat-messages');
    const chat = getCurrentChat();
    const character = getCurrentCharacter();

    if (!chat || !character) {
        container.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome to AI Chat!</h2>
                <p>Create or select a character to start chatting.</p>
                <p class="hint">Import character cards (PNG/JSON) or create your own.</p>
            </div>
        `;
        return;
    }

    if (chat.messages.length === 0) {
        container.innerHTML = `
            <div class="welcome-message">
                <h2>Chat with ${escapeHtml(character.data.name)}</h2>
                <p>Send a message to start the conversation!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = chat.messages.map((msg, index) => createMessageHTML(msg, index, character)).join('');

    // Add event listeners for message actions
    setupMessageActions();

    if (state.uiSettings.autoScroll) {
        scrollToBottom();
    }

    updateTokenCount();
}

function createMessageHTML(msg, index, character) {
    const isUser = msg.role === 'user';
    const avatar = isUser
        ? (state.userPersona.avatar ? `<img src="${state.userPersona.avatar}" alt="User">` : '👤')
        : (character?.avatar ? `<img src="${character.avatar}" alt="${escapeHtml(character.data.name)}">` : '🤖');

    const hasSwipes = msg.swipes && msg.swipes.length > 1;
    const swipeCounter = hasSwipes ? `
        <div class="swipe-counter">
            <button class="swipe-btn swipe-left" data-index="${index}" ${msg.current_swipe_index === 0 ? 'disabled' : ''}>◀</button>
            <span>${msg.current_swipe_index + 1}/${msg.swipes.length}</span>
            <button class="swipe-btn swipe-right" data-index="${index}" ${msg.current_swipe_index === msg.swipes.length - 1 ? 'disabled' : ''}>▶</button>
        </div>
    ` : '';

    const timestamp = state.uiSettings.showTimestamps && msg.timestamp
        ? `<span class="timestamp">${formatTimestamp(msg.timestamp)}</span>`
        : '';

    const content = msg.swipes ? msg.swipes[msg.current_swipe_index] : msg.content;

    return `
        <div class="message ${msg.role}" data-index="${index}">
            <div class="message-avatar">${avatar}</div>
            <div class="message-wrapper">
                <div class="message-content">${formatMessage(content)}</div>
                <div class="message-meta">
                    ${timestamp}
                    ${swipeCounter}
                </div>
                <div class="message-actions">
                    <button class="edit-msg" data-index="${index}">Edit</button>
                    <button class="copy-msg" data-index="${index}">Copy</button>
                    <button class="delete-msg danger" data-index="${index}">Delete</button>
                </div>
            </div>
        </div>
    `;
}

function setupMessageActions() {
    // Swipe buttons
    document.querySelectorAll('.swipe-left').forEach(btn => {
        btn.addEventListener('click', () => swipeMessage(parseInt(btn.dataset.index), -1));
    });

    document.querySelectorAll('.swipe-right').forEach(btn => {
        btn.addEventListener('click', () => swipeMessage(parseInt(btn.dataset.index), 1));
    });

    // Edit buttons
    document.querySelectorAll('.edit-msg').forEach(btn => {
        btn.addEventListener('click', () => editMessage(parseInt(btn.dataset.index)));
    });

    // Copy buttons
    document.querySelectorAll('.copy-msg').forEach(btn => {
        btn.addEventListener('click', () => copyMessage(parseInt(btn.dataset.index)));
    });

    // Delete buttons
    document.querySelectorAll('.delete-msg').forEach(btn => {
        btn.addEventListener('click', () => deleteMessage(parseInt(btn.dataset.index)));
    });
}

function swipeMessage(index, direction) {
    const chat = getCurrentChat();
    if (!chat) return;

    const msg = chat.messages[index];
    if (!msg.swipes) return;

    const newIndex = msg.current_swipe_index + direction;
    if (newIndex >= 0 && newIndex < msg.swipes.length) {
        msg.current_swipe_index = newIndex;
        msg.content = msg.swipes[newIndex];
        saveState();
        renderCurrentChat();
    }
}

function editMessage(index) {
    const chat = getCurrentChat();
    if (!chat) return;

    const msg = chat.messages[index];
    const newContent = prompt('Edit message:', msg.content);

    if (newContent !== null && newContent !== msg.content) {
        msg.content = newContent;
        if (msg.swipes) {
            msg.swipes[msg.current_swipe_index] = newContent;
        }
        saveState();
        renderCurrentChat();
    }
}

function copyMessage(index) {
    const chat = getCurrentChat();
    if (!chat) return;

    const msg = chat.messages[index];
    navigator.clipboard.writeText(msg.content);
}

function deleteMessage(index) {
    if (state.uiSettings.confirmDelete && !confirm('Delete this message?')) return;

    const chat = getCurrentChat();
    if (!chat) return;

    chat.messages.splice(index, 1);
    saveState();
    renderCurrentChat();
}

// === MESSAGE SENDING ===
async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();

    if (!message || state.isGenerating) return;
    if (!state.currentCharacterId || !state.selectedModel) {
        alert('Please select a character and model first.');
        return;
    }

    let chat = getCurrentChat();
    if (!chat) {
        createNewChat();
        chat = getCurrentChat();
    }

    // Add user message
    const userMsg = {
        id: generateId(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString(),
        swipes: [message],
        current_swipe_index: 0
    };
    chat.messages.push(userMsg);
    chat.updated_at = new Date().toISOString();

    input.value = '';
    input.style.height = 'auto';

    saveState();
    renderCurrentChat();

    // Generate response
    await generateResponse();
}

async function generateResponse(continueMsg = false) {
    const chat = getCurrentChat();
    const character = getCurrentCharacter();
    if (!chat || !character) return;

    state.isGenerating = true;
    state.abortController = new AbortController();
    updateGeneratingUI(true);

    try {
        const messages = buildPromptMessages(chat, character, continueMsg);

        // Add typing indicator
        const typingId = addTypingIndicator();

        if (state.generationSettings.stream) {
            await streamResponse(messages, typingId, continueMsg);
        } else {
            await nonStreamResponse(messages, typingId, continueMsg);
        }

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Generation error:', error);
            showError(error.message);
        }
    } finally {
        state.isGenerating = false;
        state.abortController = null;
        updateGeneratingUI(false);
        removeTypingIndicator();
    }
}

function buildPromptMessages(chat, character, continueMsg = false) {
    const messages = [];
    const d = character.data;

    // System prompt
    let systemContent = '';

    if (state.promptSettings.useCharSystemPrompt && d.system_prompt) {
        systemContent = d.system_prompt;
    } else if (state.promptSettings.systemPrompt) {
        systemContent = state.promptSettings.systemPrompt;
    }

    // Add character info to system
    const charInfo = [];
    if (d.description) charInfo.push(`Character Description: ${d.description}`);
    if (d.personality) charInfo.push(`Personality: ${d.personality}`);
    if (d.scenario) charInfo.push(`Scenario: ${d.scenario}`);

    if (charInfo.length > 0) {
        systemContent += '\n\n' + charInfo.join('\n\n');
    }

    // Add user persona info
    if (state.userPersona.name || state.userPersona.description) {
        let personaInfo = '\n\n[User Information]';
        personaInfo += `\nThe user's name is: ${state.userPersona.name || 'User'}`;
        if (state.userPersona.description) {
            personaInfo += `\nUser description/persona: ${state.userPersona.description}`;
        }
        systemContent += personaInfo;
    }

    // Add example messages
    if (d.mes_example && state.promptSettings.exampleMsgMode !== 'never') {
        if (state.promptSettings.exampleMsgMode === 'always' ||
            (state.promptSettings.exampleMsgMode === 'first' && chat.messages.length <= 1)) {
            systemContent += '\n\nExample dialogue:\n' + d.mes_example;
        }
    }

    systemContent = replaceMacros(systemContent, character);

    if (systemContent) {
        messages.push({ role: 'system', content: systemContent });
    }

    // Add chat history
    const historyMessages = chat.messages.slice(-Math.floor(state.generationSettings.context_size / 100));

    // Author's note injection
    const depth = state.promptSettings.authorsNoteDepth;
    const authorsNote = state.promptSettings.authorsNote;

    historyMessages.forEach((msg, idx) => {
        const content = replaceMacros(msg.content, character);

        // Inject author's note at depth
        if (authorsNote && idx === historyMessages.length - depth - 1) {
            messages.push({ role: 'system', content: `[Author's Note: ${authorsNote}]` });
        }

        messages.push({ role: msg.role, content });
    });

    // Post-history instructions
    const postHistory = d.post_history_instructions || state.promptSettings.postHistory;
    if (postHistory) {
        messages.push({ role: 'system', content: replaceMacros(postHistory, character) });
    }

    // For continue, add a partial message
    if (continueMsg && chat.messages.length > 0) {
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (lastMsg.role === 'assistant') {
            messages[messages.length - 1].content += ' ';
        }
    }

    return messages;
}

async function streamResponse(messages, typingId, continueMsg) {
    const chat = getCurrentChat();
    const character = getCurrentCharacter();

    const response = await fetch(`${CONFIG.OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.href,
            'X-Title': 'AI Chat App'
        },
        body: JSON.stringify({
            model: state.selectedModel,
            messages,
            stream: true,
            temperature: state.generationSettings.temperature,
            max_tokens: state.generationSettings.max_tokens,
            top_p: state.generationSettings.top_p,
            frequency_penalty: state.generationSettings.frequency_penalty,
            presence_penalty: state.generationSettings.presence_penalty,
            stop: state.generationSettings.stop_sequences.length > 0 ? state.generationSettings.stop_sequences : undefined
        }),
        signal: state.abortController.signal
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'API Error');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    // For continue, prepend existing content
    if (continueMsg && chat.messages.length > 0) {
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (lastMsg.role === 'assistant') {
            fullContent = lastMsg.content;
        }
    }

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

        for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                    fullContent += content;
                    updateTypingContent(typingId, fullContent);
                }
            } catch (e) {
                // Skip invalid JSON
            }
        }
    }

    // Save the response
    removeTypingIndicator();

    if (continueMsg && chat.messages.length > 0) {
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (lastMsg.role === 'assistant') {
            lastMsg.content = fullContent;
            if (lastMsg.swipes) {
                lastMsg.swipes[lastMsg.current_swipe_index] = fullContent;
            }
        }
    } else {
        chat.messages.push({
            id: generateId(),
            role: 'assistant',
            content: fullContent,
            timestamp: new Date().toISOString(),
            swipes: [fullContent],
            current_swipe_index: 0
        });
    }

    chat.updated_at = new Date().toISOString();
    saveState();
    renderCurrentChat();
}

async function nonStreamResponse(messages, typingId, continueMsg) {
    const chat = getCurrentChat();

    const response = await fetch(`${CONFIG.OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': window.location.href,
            'X-Title': 'AI Chat App'
        },
        body: JSON.stringify({
            model: state.selectedModel,
            messages,
            temperature: state.generationSettings.temperature,
            max_tokens: state.generationSettings.max_tokens,
            top_p: state.generationSettings.top_p,
            frequency_penalty: state.generationSettings.frequency_penalty,
            presence_penalty: state.generationSettings.presence_penalty,
            stop: state.generationSettings.stop_sequences.length > 0 ? state.generationSettings.stop_sequences : undefined
        }),
        signal: state.abortController.signal
    });

    const data = await response.json();

    if (data.error) {
        throw new Error(data.error.message || 'API Error');
    }

    let content = data.choices[0].message.content;

    removeTypingIndicator();

    if (continueMsg && chat.messages.length > 0) {
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (lastMsg.role === 'assistant') {
            content = lastMsg.content + content;
            lastMsg.content = content;
            if (lastMsg.swipes) {
                lastMsg.swipes[lastMsg.current_swipe_index] = content;
            }
        }
    } else {
        chat.messages.push({
            id: generateId(),
            role: 'assistant',
            content,
            timestamp: new Date().toISOString(),
            swipes: [content],
            current_swipe_index: 0
        });
    }

    chat.updated_at = new Date().toISOString();
    saveState();
    renderCurrentChat();
}

function addTypingIndicator() {
    const container = document.getElementById('chat-messages');
    const character = getCurrentCharacter();
    const avatar = character?.avatar ? `<img src="${character.avatar}" alt="">` : '🤖';

    const div = document.createElement('div');
    div.className = 'message assistant typing-message';
    div.id = 'typing-indicator';
    div.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-wrapper">
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    container.appendChild(div);
    scrollToBottom();
    return div.id;
}

function updateTypingContent(id, content) {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.querySelector('.message-content').innerHTML = formatMessage(content);
        if (state.uiSettings.autoScroll) {
            scrollToBottom();
        }
    }
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function stopGeneration() {
    if (state.abortController) {
        state.abortController.abort();
    }
}

async function regenerateLastMessage() {
    const chat = getCurrentChat();
    if (!chat || chat.messages.length === 0) return;

    // Find last assistant message
    let lastAssistantIndex = -1;
    for (let i = chat.messages.length - 1; i >= 0; i--) {
        if (chat.messages[i].role === 'assistant') {
            lastAssistantIndex = i;
            break;
        }
    }

    if (lastAssistantIndex === -1) return;

    const msg = chat.messages[lastAssistantIndex];

    // Store the old content as a swipe
    if (!msg.swipes) {
        msg.swipes = [msg.content];
        msg.current_swipe_index = 0;
    }

    // Remove messages after this one temporarily
    const removed = chat.messages.splice(lastAssistantIndex);

    saveState();
    renderCurrentChat();

    // Generate new response
    await generateResponse();

    // Add new response as a swipe to the original message
    const newChat = getCurrentChat();
    if (newChat.messages.length > 0) {
        const newMsg = newChat.messages[newChat.messages.length - 1];
        if (newMsg.role === 'assistant') {
            msg.swipes.push(newMsg.content);
            msg.current_swipe_index = msg.swipes.length - 1;
            msg.content = newMsg.content;

            // Replace the new message with the updated original
            newChat.messages[newChat.messages.length - 1] = msg;
            saveState();
            renderCurrentChat();
        }
    }
}

async function continueGeneration() {
    if (state.isGenerating) return;

    const chat = getCurrentChat();
    if (!chat || chat.messages.length === 0) return;

    const lastMsg = chat.messages[chat.messages.length - 1];
    if (lastMsg.role !== 'assistant') return;

    await generateResponse(true);
}

async function impersonate() {
    const chat = getCurrentChat();
    const character = getCurrentCharacter();
    if (!chat || !character) return;

    // Generate a user message from the AI
    state.isGenerating = true;
    state.abortController = new AbortController();
    updateGeneratingUI(true);

    try {
        const messages = buildPromptMessages(chat, character);
        messages.push({
            role: 'system',
            content: `Now write a short response as if you were ${state.userPersona.name} (the user), responding to ${character.data.name}. Write in first person.`
        });

        const response = await fetch(`${CONFIG.OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'AI Chat App'
            },
            body: JSON.stringify({
                model: state.selectedModel,
                messages,
                temperature: state.generationSettings.temperature,
                max_tokens: 500
            }),
            signal: state.abortController.signal
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

        const content = data.choices[0].message.content;
        document.getElementById('message-input').value = content;

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Impersonate error:', error);
        }
    } finally {
        state.isGenerating = false;
        state.abortController = null;
        updateGeneratingUI(false);
    }
}

function updateGeneratingUI(generating) {
    document.getElementById('send-btn').classList.toggle('hidden', generating);
    document.getElementById('stop-btn').classList.toggle('hidden', !generating);
    document.getElementById('send-btn').disabled = generating;
}

// === IMPORT/EXPORT ===
async function handleImportFiles(files) {
    state.pendingImports = [];

    for (const file of files) {
        try {
            const character = await parseCharacterFile(file);
            if (character) {
                state.pendingImports.push(character);
            }
        } catch (error) {
            console.error(`Failed to parse ${file.name}:`, error);
        }
    }

    renderImportPreview();
}

async function parseCharacterFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();

    if (extension === 'json') {
        return parseJSONCharacter(file);
    } else if (extension === 'png') {
        return parsePNGCharacter(file);
    } else if (extension === 'webp') {
        return parseWEBPCharacter(file);
    }

    return null;
}

async function parseJSONCharacter(file) {
    const text = await file.text();
    const data = JSON.parse(text);

    // Handle both V1 and V2 formats
    let charData;
    if (data.spec === 'chara_card_v2' && data.data) {
        charData = data.data;
    } else {
        // V1 format - fields at root
        charData = data;
    }

    return createCharacter(charData);
}

async function parsePNGCharacter(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const arrayBuffer = e.target.result;
                const dataView = new DataView(arrayBuffer);

                // Verify PNG signature
                const signature = [137, 80, 78, 71, 13, 10, 26, 10];
                for (let i = 0; i < 8; i++) {
                    if (dataView.getUint8(i) !== signature[i]) {
                        throw new Error('Not a valid PNG file');
                    }
                }

                // Parse chunks
                let offset = 8;
                let charaData = null;

                while (offset < arrayBuffer.byteLength) {
                    const length = dataView.getUint32(offset);
                    const type = String.fromCharCode(
                        dataView.getUint8(offset + 4),
                        dataView.getUint8(offset + 5),
                        dataView.getUint8(offset + 6),
                        dataView.getUint8(offset + 7)
                    );

                    if (type === 'tEXt' || type === 'iTXt') {
                        const chunkData = new Uint8Array(arrayBuffer, offset + 8, length);
                        const text = new TextDecoder('latin1').decode(chunkData);

                        if (text.startsWith('chara\0')) {
                            const base64Data = text.slice(6);
                            charaData = atob(base64Data);
                        }
                    }

                    offset += 12 + length; // length + type + data + crc

                    if (type === 'IEND') break;
                }

                if (charaData) {
                    const data = JSON.parse(charaData);
                    const charData = data.spec === 'chara_card_v2' ? data.data : data;

                    // Get image as base64
                    const imageReader = new FileReader();
                    imageReader.onload = (imgE) => {
                        const character = createCharacter(charData);
                        character.avatar = imgE.target.result;
                        resolve(character);
                    };
                    imageReader.readAsDataURL(file);
                } else {
                    reject(new Error('No character data found in PNG'));
                }
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

async function parseWEBPCharacter(file) {
    // WEBP parsing is more complex - for now, try to read as blob and check for text
    // This is a simplified implementation
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = new TextDecoder('utf-8').decode(e.target.result);
                const match = text.match(/chara[^\{]*(\{[\s\S]*\})/);

                if (match) {
                    const data = JSON.parse(match[1]);
                    const charData = data.spec === 'chara_card_v2' ? data.data : data;

                    const imageReader = new FileReader();
                    imageReader.onload = (imgE) => {
                        const character = createCharacter(charData);
                        character.avatar = imgE.target.result;
                        resolve(character);
                    };
                    imageReader.readAsDataURL(file);
                } else {
                    reject(new Error('No character data found in WEBP'));
                }
            } catch (error) {
                reject(error);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}

function renderImportPreview() {
    const container = document.getElementById('import-preview');
    const confirmBtn = document.getElementById('confirm-import-btn');

    if (state.pendingImports.length === 0) {
        container.classList.add('hidden');
        confirmBtn.classList.add('hidden');
        return;
    }

    container.classList.remove('hidden');
    confirmBtn.classList.remove('hidden');

    container.innerHTML = state.pendingImports.map((char, index) => `
        <div class="import-preview-item" data-index="${index}">
            <div class="preview-avatar">
                ${char.avatar ? `<img src="${char.avatar}" alt="">` : '🤖'}
            </div>
            <div class="preview-info">
                <div class="preview-name">${escapeHtml(char.data.name)}</div>
                <div class="preview-desc">${escapeHtml(char.data.description?.substring(0, 100) || 'No description')}</div>
            </div>
        </div>
    `).join('');
}

function confirmImport() {
    state.pendingImports.forEach(char => {
        state.characters.push(char);
    });

    if (state.pendingImports.length > 0) {
        state.currentCharacterId = state.pendingImports[0].id;
        createNewChat();
    }

    state.pendingImports = [];
    saveState();
    renderCharacterList();
    renderCurrentChat();
    updateCurrentCharacterDisplay();
    closeModal('import-modal');

    // Reset import preview
    document.getElementById('import-preview').innerHTML = '';
    document.getElementById('import-preview').classList.add('hidden');
    document.getElementById('confirm-import-btn').classList.add('hidden');
}

function exportCharacterAsJSON() {
    const character = state.characters.find(c => c.id === state.editingCharacterId);
    if (!character) return;

    const exportData = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: character.data
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `${character.data.name}.json`);
    closeModal('export-modal');
}

async function exportCharacterAsPNG() {
    const character = state.characters.find(c => c.id === state.editingCharacterId);
    if (!character) return;

    const exportData = {
        spec: 'chara_card_v2',
        spec_version: '2.0',
        data: character.data
    };

    const jsonString = JSON.stringify(exportData);
    const base64Data = btoa(unescape(encodeURIComponent(jsonString)));

    // Create a canvas with the avatar or a default image
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 600;

    if (character.avatar) {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            finishPNGExport(canvas, base64Data, character.data.name);
        };
        img.src = character.avatar;
    } else {
        // Create a placeholder image
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.font = '48px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(character.data.name.charAt(0), canvas.width / 2, canvas.height / 2 + 16);
        finishPNGExport(canvas, base64Data, character.data.name);
    }

    closeModal('export-modal');
}

function finishPNGExport(canvas, base64Data, name) {
    // For simplicity, we'll just export the image and note that full PNG chunk embedding
    // would require more complex PNG manipulation
    canvas.toBlob((blob) => {
        downloadBlob(blob, `${name}.png`);
    }, 'image/png');

    // Also export JSON alongside for now
    const character = state.characters.find(c => c.id === state.editingCharacterId);
    if (character) {
        const exportData = { spec: 'chara_card_v2', spec_version: '2.0', data: character.data };
        const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        downloadBlob(jsonBlob, `${name}_data.json`);
    }
}

function exportCurrentChat() {
    const chat = getCurrentChat();
    const character = getCurrentCharacter();
    if (!chat || !character) return;

    const exportData = {
        character: character.data.name,
        exported_at: new Date().toISOString(),
        messages: chat.messages
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `chat_${character.data.name}_${Date.now()}.json`);
}

function clearCurrentChat() {
    if (state.uiSettings.confirmDelete && !confirm('Clear all messages in this chat?')) return;

    const chat = getCurrentChat();
    if (chat) {
        chat.messages = [];
        saveState();
        renderCurrentChat();
    }
}

function exportAllData() {
    const exportData = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        characters: state.characters,
        chats: state.chats,
        settings: {
            generation: state.generationSettings,
            prompt: state.promptSettings,
            ui: state.uiSettings,
            presets: state.presets
        },
        userPersona: state.userPersona
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `ai_chat_backup_${Date.now()}.json`);
}

function importBackup(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);

            if (data.characters) state.characters = data.characters;
            if (data.chats) state.chats = data.chats;
            if (data.settings) {
                if (data.settings.generation) state.generationSettings = { ...DEFAULT_GENERATION_SETTINGS, ...data.settings.generation };
                if (data.settings.prompt) state.promptSettings = { ...DEFAULT_PROMPT_SETTINGS, ...data.settings.prompt };
                if (data.settings.ui) state.uiSettings = { ...DEFAULT_UI_SETTINGS, ...data.settings.ui };
                if (data.settings.presets) state.presets = { ...DEFAULT_PRESETS, ...data.settings.presets };
            }
            if (data.userPersona) state.userPersona = data.userPersona;

            saveState();
            applyUISettings();
            renderCharacterList();
            renderCurrentChat();
            updateUIFromState();
            alert('Backup imported successfully!');
        } catch (error) {
            alert('Failed to import backup: ' + error.message);
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function clearAllData() {
    if (!confirm('This will delete ALL your data including characters, chats, and settings. Are you sure?')) return;
    if (!confirm('This action cannot be undone. Proceed?')) return;

    localStorage.removeItem('aiChatAppState');
    location.reload();
}

// === PRESETS ===
function loadPreset(e) {
    const presetName = e.target.value;
    const preset = state.presets[presetName];

    if (preset) {
        state.generationSettings = { ...DEFAULT_GENERATION_SETTINGS, ...preset };
        updateUIFromState();
        saveState();
    }
}

function saveCurrentPreset() {
    const name = document.getElementById('preset-name-input').value.trim();
    if (!name) {
        alert('Please enter a preset name');
        return;
    }

    state.presets[name] = { ...state.generationSettings };
    saveState();

    // Update preset select
    const select = document.getElementById('preset-select');
    if (!select.querySelector(`option[value="${name}"]`)) {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        select.appendChild(option);
    }
    select.value = name;

    closeModal('preset-save-modal');
    document.getElementById('preset-name-input').value = '';
}

// === UI HELPERS ===
function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

function applyUISettings() {
    document.body.setAttribute('data-theme', state.uiSettings.theme);
    document.body.className = `font-${state.uiSettings.fontSize}`;

    const tokenCounter = document.getElementById('token-counter');
    if (tokenCounter) {
        tokenCounter.classList.toggle('hidden', !state.uiSettings.showTokenCount);
    }
}

function updateUIFromState() {
    // Update generation parameters
    const params = {
        'temperature': state.generationSettings.temperature,
        'max-tokens': state.generationSettings.max_tokens,
        'top-p': state.generationSettings.top_p,
        'top-k': state.generationSettings.top_k,
        'min-p': state.generationSettings.min_p,
        'repetition-penalty': state.generationSettings.repetition_penalty,
        'frequency-penalty': state.generationSettings.frequency_penalty,
        'presence-penalty': state.generationSettings.presence_penalty,
        'context-size': state.generationSettings.context_size,
        'typical-p': state.generationSettings.typical_p,
        'top-a': state.generationSettings.top_a,
        'tfs': state.generationSettings.tfs,
        'mirostat-tau': state.generationSettings.mirostat_tau,
        'mirostat-eta': state.generationSettings.mirostat_eta
    };

    Object.entries(params).forEach(([id, value]) => {
        const slider = document.getElementById(id);
        const valueInput = document.getElementById(`${id}-value`);
        if (slider) slider.value = value;
        if (valueInput) valueInput.value = value;
    });

    const mirostatMode = document.getElementById('mirostat-mode');
    if (mirostatMode) mirostatMode.value = state.generationSettings.mirostat_mode;

    const stopSeq = document.getElementById('stop-sequences');
    if (stopSeq) stopSeq.value = state.generationSettings.stop_sequences.join(', ');

    const streamCheck = document.getElementById('stream-responses');
    if (streamCheck) streamCheck.checked = state.generationSettings.stream;

    // Update UI settings
    const themeSelect = document.getElementById('theme-select');
    if (themeSelect) themeSelect.value = state.uiSettings.theme;

    const fontSelect = document.getElementById('font-size-select');
    if (fontSelect) fontSelect.value = state.uiSettings.fontSize;

    const checkboxes = {
        'show-timestamps': state.uiSettings.showTimestamps,
        'auto-scroll': state.uiSettings.autoScroll,
        'confirm-delete': state.uiSettings.confirmDelete,
        'show-token-count': state.uiSettings.showTokenCount
    };

    Object.entries(checkboxes).forEach(([id, value]) => {
        const checkbox = document.getElementById(id);
        if (checkbox) checkbox.checked = value;
    });

    // Update persona display
    updateUserPersonaDisplay();
}

function updateUserPersonaDisplay() {
    document.getElementById('user-name-display').textContent = state.userPersona.name;
    const avatarDisplay = document.getElementById('user-avatar-display');
    if (state.userPersona.avatar) {
        avatarDisplay.innerHTML = `<img src="${state.userPersona.avatar}" alt="Avatar">`;
    } else {
        avatarDisplay.innerHTML = '👤';
    }

    // Update persona modal
    document.getElementById('persona-name').value = state.userPersona.name;
    document.getElementById('persona-description').value = state.userPersona.description || '';
    const personaPreview = document.getElementById('persona-avatar-preview');
    if (state.userPersona.avatar) {
        personaPreview.innerHTML = `<img src="${state.userPersona.avatar}" alt="Avatar">`;
    }
}

function updateTokenCount() {
    const chat = getCurrentChat();
    const character = getCurrentCharacter();
    if (!chat || !character) return;

    // Simple token estimation (roughly 4 chars per token)
    let totalChars = 0;

    if (state.promptSettings.systemPrompt) totalChars += state.promptSettings.systemPrompt.length;
    if (character.data.description) totalChars += character.data.description.length;
    if (character.data.personality) totalChars += character.data.personality.length;
    if (character.data.scenario) totalChars += character.data.scenario.length;
    if (character.data.mes_example) totalChars += character.data.mes_example.length;

    chat.messages.forEach(msg => {
        totalChars += msg.content.length;
    });

    const estimatedTokens = Math.ceil(totalChars / 4);
    document.getElementById('token-count').textContent = estimatedTokens;
    document.getElementById('token-max').textContent = state.generationSettings.context_size;
}

function autoResizeTextarea(e) {
    const textarea = e?.target || document.getElementById('message-input');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

function scrollToBottom() {
    const container = document.getElementById('chat-messages');
    container.scrollTop = container.scrollHeight;
}

function showError(message) {
    const container = document.getElementById('chat-messages');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    container.appendChild(errorDiv);
    scrollToBottom();

    setTimeout(() => errorDiv.remove(), 5000);
}

// === UTILITY FUNCTIONS ===
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatMessage(content) {
    if (!content) return '';
    let formatted = escapeHtml(content);

    // Code blocks
    formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function replaceMacros(text, character) {
    if (!text) return '';

    const userName = state.userPersona.name || 'User';
    const charName = character?.data?.name || 'Assistant';

    return text
        .replace(/\{\{user\}\}/gi, userName)
        .replace(/\{\{char\}\}/gi, charName)
        .replace(/\{\{time\}\}/gi, new Date().toLocaleTimeString())
        .replace(/\{\{date\}\}/gi, new Date().toLocaleDateString())
        .replace(/\{\{random:([^}]+)\}\}/gi, (match, options) => {
            const choices = options.split(',').map(s => s.trim());
            return choices[Math.floor(Math.random() * choices.length)];
        });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
