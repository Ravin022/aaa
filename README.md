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

## Mobile Access

The app is fully responsive and works on mobile devices. To access from your phone or tablet:

### Option 1: Local Network (Same WiFi)

1. Find your computer's local IP address:
   ```bash
   # On Linux/Mac
   hostname -I
   # or
   ip addr show | grep "inet "

   # On Windows
   ipconfig
   ```

2. Start a local server on your computer:
   ```bash
   python -m http.server 8000
   ```

3. On your mobile device, open a browser and visit:
   ```
   http://YOUR_COMPUTER_IP:8000
   ```
   Example: `http://192.168.1.100:8000`

### Option 2: Using ngrok (Access from Anywhere)

1. Install ngrok from https://ngrok.com/download

2. Start a local server:
   ```bash
   python -m http.server 8000
   ```

3. In another terminal, run:
   ```bash
   ngrok http 8000
   ```

4. Use the provided ngrok URL (e.g., `https://abc123.ngrok.io`) on any device

### Option 3: Host on GitHub Pages (Free)

1. Push your code to a GitHub repository
2. Go to Settings > Pages
3. Select your branch and save
4. Access via `https://yourusername.github.io/repo-name`

### Mobile Navigation

On mobile devices:
- Tap the **hamburger menu** (☰) on the left to open the character sidebar
- Tap the **settings icon** on the right to open generation settings
- Tap outside or on the overlay to close sidebars

## Technology

- Pure HTML, CSS, and JavaScript (no frameworks)
- OpenRouter API for AI model access
- LocalStorage for conversation persistence

## API

This app uses the OpenRouter API:
- Base URL: `https://openrouter.ai/api/v1`
- All free models are automatically loaded from the API
