// OpenRouter API Configuration
const OPENROUTER_API_KEY = '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';
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

// Free models list - will be populated from API
let freeModels = [];

// App State
let conversations = JSON.parse(localStorage.getItem('conversations')) || [];
let currentConversationId = null;
let isGenerating = false;

// DOM Elements
const modelSelect = document.getElementById('model-select');
const currentModelName = document.getElementById('current-model-name');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const conversationList = document.getElementById('conversation-list');

// Initialize the app
async function init() {
    await loadFreeModels();
    renderConversationList();
    setupEventListeners();

    // Auto-resize textarea
    messageInput.addEventListener('input', autoResizeTextarea);
}

// Fetch free models from OpenRouter API
async function loadFreeModels() {
    try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            }
        });

        const data = await response.json();

        // Filter for free models (models with :free suffix or zero pricing)
        freeModels = data.data.filter(model => {
            const isFree = model.id.includes(':free') ||
                (model.pricing &&
                 parseFloat(model.pricing.prompt) === 0 &&
                 parseFloat(model.pricing.completion) === 0);
            return isFree;
        }).sort((a, b) => a.name.localeCompare(b.name));

        populateModelSelect();
    } catch (error) {
        console.error('Failed to load models:', error);
        // Fallback to known free models
        freeModels = [
            { id: 'allenai/molmo-2-8b:free', name: 'AllenAI: Molmo2 8B (free)' },
            { id: 'xiaomi/mimo-v2-flash:free', name: 'Xiaomi: MiMo-V2-Flash (free)' },
            { id: 'mistralai/devstral-2512:free', name: 'Mistral: Devstral 2 2512 (free)' },
            { id: 'nvidia/nemotron-3-nano-30b-a3b:free', name: 'NVIDIA: Nemotron 3 Nano 30B A3B (free)' },
            { id: 'arcee-ai/trinity-mini:free', name: 'Arcee AI: Trinity Mini (free)' },
            { id: 'tngtech/tng-r1t-chimera:free', name: 'TNG: R1T Chimera (free)' },
            { id: 'nvidia/nemotron-nano-12b-v2-vl:free', name: 'NVIDIA: Nemotron Nano 12B 2 VL (free)' },
            { id: 'google/gemma-3-1b-it:free', name: 'Google: Gemma 3 1B (free)' },
            { id: 'google/gemma-3-4b-it:free', name: 'Google: Gemma 3 4B (free)' },
            { id: 'meta-llama/llama-3.2-1b-instruct:free', name: 'Meta: Llama 3.2 1B Instruct (free)' },
            { id: 'meta-llama/llama-3.2-3b-instruct:free', name: 'Meta: Llama 3.2 3B Instruct (free)' },
            { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Microsoft: Phi-3 Mini 128K (free)' },
            { id: 'qwen/qwen-2.5-7b-instruct:free', name: 'Qwen: Qwen 2.5 7B (free)' },
            { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek: R1 0528 (free)' },
        ];
        populateModelSelect();
    }
}

// Populate the model select dropdown
function populateModelSelect() {
    modelSelect.innerHTML = '<option value="">Select a model...</option>';

    freeModels.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.name;
        modelSelect.appendChild(option);
    });

    // Restore previously selected model
    const lastModel = localStorage.getItem('selectedModel');
    if (lastModel && freeModels.some(m => m.id === lastModel)) {
        modelSelect.value = lastModel;
        updateCurrentModelDisplay();
    }
}

// Update the current model display
function updateCurrentModelDisplay() {
    const selectedModel = freeModels.find(m => m.id === modelSelect.value);
    if (selectedModel) {
        currentModelName.textContent = selectedModel.name;
        localStorage.setItem('selectedModel', modelSelect.value);
    } else {
        currentModelName.textContent = 'Select a model to start';
    }
}

// Setup event listeners
function setupEventListeners() {
    modelSelect.addEventListener('change', updateCurrentModelDisplay);

    sendBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    newChatBtn.addEventListener('click', createNewConversation);

    clearAllBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to delete all conversations?')) {
            conversations = [];
            currentConversationId = null;
            saveConversations();
            renderConversationList();
            renderChatMessages();
        }
    });
}

// Auto-resize textarea
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
}

// Create a new conversation
function createNewConversation() {
    const conversation = {
        id: Date.now().toString(),
        title: 'New Chat',
        model: modelSelect.value,
        messages: [],
        createdAt: new Date().toISOString()
    };

    conversations.unshift(conversation);
    currentConversationId = conversation.id;
    saveConversations();
    renderConversationList();
    renderChatMessages();
    messageInput.focus();
}

// Get current conversation
function getCurrentConversation() {
    return conversations.find(c => c.id === currentConversationId);
}

// Save conversations to localStorage
function saveConversations() {
    localStorage.setItem('conversations', JSON.stringify(conversations));
}

// Render conversation list
function renderConversationList() {
    conversationList.innerHTML = '';

    if (conversations.length === 0) {
        conversationList.innerHTML = '<p style="padding: 12px; color: var(--text-secondary); font-size: 0.85rem;">No conversations yet</p>';
        return;
    }

    conversations.forEach(conv => {
        const div = document.createElement('div');
        div.className = `conversation-item ${conv.id === currentConversationId ? 'active' : ''}`;
        div.innerHTML = `
            <span class="title">${escapeHtml(conv.title)}</span>
            <button class="delete-btn" title="Delete conversation">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        `;

        div.querySelector('.title').addEventListener('click', () => {
            currentConversationId = conv.id;
            if (conv.model) {
                modelSelect.value = conv.model;
                updateCurrentModelDisplay();
            }
            renderConversationList();
            renderChatMessages();
        });

        div.querySelector('.delete-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConversation(conv.id);
        });

        conversationList.appendChild(div);
    });
}

// Delete a conversation
function deleteConversation(id) {
    conversations = conversations.filter(c => c.id !== id);
    if (currentConversationId === id) {
        currentConversationId = conversations.length > 0 ? conversations[0].id : null;
    }
    saveConversations();
    renderConversationList();
    renderChatMessages();
}

// Render chat messages
function renderChatMessages() {
    const conversation = getCurrentConversation();

    if (!conversation || conversation.messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome to AI Chat!</h2>
                <p>Select a model from the sidebar and start chatting with AI.</p>
                <p class="hint">All models are free to use via OpenRouter.</p>
            </div>
        `;
        return;
    }

    chatMessages.innerHTML = '';

    conversation.messages.forEach(msg => {
        const messageDiv = createMessageElement(msg.role, msg.content);
        chatMessages.appendChild(messageDiv);
    });

    scrollToBottom();
}

// Create a message element
function createMessageElement(role, content) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    const avatar = role === 'user' ? '👤' : '🤖';

    div.innerHTML = `
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">${formatMessage(content)}</div>
    `;

    return div;
}

// Format message content (handle markdown-like formatting)
function formatMessage(content) {
    // Escape HTML first
    let formatted = escapeHtml(content);

    // Handle code blocks
    formatted = formatted.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Handle inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Handle bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Handle italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Handle line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

// Escape HTML characters
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Scroll to bottom of chat
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Send a message
async function sendMessage() {
    const message = messageInput.value.trim();

    if (!message || isGenerating) return;

    if (!modelSelect.value) {
        alert('Please select a model first');
        return;
    }

    // Create new conversation if needed
    if (!currentConversationId) {
        createNewConversation();
    }

    const conversation = getCurrentConversation();

    // Update conversation model
    conversation.model = modelSelect.value;

    // Add user message
    conversation.messages.push({
        role: 'user',
        content: message
    });

    // Update title if first message
    if (conversation.messages.length === 1) {
        conversation.title = message.substring(0, 50) + (message.length > 50 ? '...' : '');
    }

    saveConversations();
    renderConversationList();
    renderChatMessages();

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Show typing indicator
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant';
    typingDiv.innerHTML = `
        <div class="message-avatar">🤖</div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    chatMessages.appendChild(typingDiv);
    scrollToBottom();

    isGenerating = true;
    sendBtn.disabled = true;

    try {
        const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': window.location.href,
                'X-Title': 'AI Chat App'
            },
            body: JSON.stringify({
                model: modelSelect.value,
                messages: conversation.messages.map(m => ({
                    role: m.role,
                    content: m.content
                }))
            })
        });

        const data = await response.json();

        // Remove typing indicator
        chatMessages.removeChild(typingDiv);

        if (data.error) {
            throw new Error(data.error.message || 'API Error');
        }

        const assistantMessage = data.choices[0].message.content;

        // Add assistant message
        conversation.messages.push({
            role: 'assistant',
            content: assistantMessage
        });

        saveConversations();
        renderChatMessages();

    } catch (error) {
        console.error('Error:', error);

        // Remove typing indicator
        if (typingDiv.parentNode) {
            chatMessages.removeChild(typingDiv);
        }

        // Show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `Error: ${error.message}. Please try again.`;
        chatMessages.appendChild(errorDiv);
        scrollToBottom();

        // Remove the user message from conversation since it failed
        conversation.messages.pop();
        saveConversations();
    }

    isGenerating = false;
    sendBtn.disabled = false;
    messageInput.focus();
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);
