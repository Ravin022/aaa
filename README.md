# AI Chat - OpenRouter

A modern AI chat application that lets you chat with all free OpenRouter models.

## Features

- **Multiple AI Models**: Access all free models available on OpenRouter
- **Conversation History**: Your conversations are saved locally in your browser
- **Modern UI**: Clean, dark-themed interface inspired by modern chat applications
- **Responsive Design**: Works on desktop and mobile devices
- **Markdown Support**: Code blocks, bold, italic text formatting

## Free Models Available

The app automatically fetches all free models from OpenRouter, including:

- AllenAI: Molmo2 8B
- Xiaomi: MiMo-V2-Flash
- Mistral: Devstral 2 2512
- NVIDIA: Nemotron models
- Arcee AI: Trinity Mini
- Google: Gemma 3 models
- Meta: Llama 3.2 models
- Microsoft: Phi-3 Mini
- Qwen: Qwen 2.5 7B
- DeepSeek: R1
- And more...

## Usage

1. Open `index.html` in your web browser
2. Select a model from the dropdown in the sidebar
3. Type your message and press Enter to send
4. Your conversations are automatically saved

## How to Run

Simply open the `index.html` file in any modern web browser:

```bash
# Option 1: Open directly
open index.html

# Option 2: Use a local server (recommended for development)
python -m http.server 8000
# Then visit http://localhost:8000

# Option 3: Use Node.js http-server
npx http-server
```

## Keyboard Shortcuts

- `Enter` - Send message
- `Shift + Enter` - New line in message

## Technology

- Pure HTML, CSS, and JavaScript (no frameworks)
- OpenRouter API for AI model access
- LocalStorage for conversation persistence

## API

This app uses the OpenRouter API:
- Base URL: `https://openrouter.ai/api/v1`
- All free models are automatically loaded from the API
