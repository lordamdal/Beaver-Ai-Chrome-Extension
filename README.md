# Beaver Assistant - Chrome Extension

Beaver Assistant is a voice-enabled Chrome extension that serves as your personal web assistant, powered by Google Cloud APIs. It provides webpage summarization, voice interaction, and intelligent responses to your commands.

## Features

### 🎙️ Voice Interaction
- Wake word detection ("Hey Beaver" or "Beaver")
- Natural voice responses using speech synthesis
- Continuous conversation capability
- Voice command processing
- Natural human-like interactions with follow-up questions

### 📝 Page Summarization
- Quick summarization of any webpage
- Voice narration of summaries
- Option to stop narration at any time
- Detailed explanations on request

### 🧠 Intelligent Assistance
- Powered by Google's Gemini Pro API
- Context-aware responses
- Website recommendations based on queries
- Natural language understanding

### 🎯 Key Capabilities
- Real-time voice recognition
- Natural female voice output
- Webpage content analysis
- Voice command processing
- Dynamic response generation

## Installation

1. Clone this repository:
```bash
git clone https://github.com/lordamdal/Beaver-Ai-Chrome-Extension.git
```

2. Open Chrome and navigate to:
```
chrome://extensions/
```

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the extension directory

5. Configure your Google Cloud API key in the extension popup

## Setup

### Prerequisites
- Google Chrome browser
- Google Cloud Platform account
- Gemini Pro API access
- Active internet connection

### API Configuration
1. Create a project in Google Cloud Console
2. Enable the following APIs:
   - Gemini Pro API
3. Create API credentials
4. Copy your API key into the extension

## Usage

### Basic Commands
- "Hey Beaver" or "Beaver" to activate
- "Summarize this page" for page summary
- "Find websites about [topic]" for recommendations
- Natural conversation for general queries

### Voice Controls
- Click microphone icon to start/stop listening
- Use "Stop Speaking" button to halt narration
- Natural conversational flow supported

## Technical Details

### APIs Used
- Gemini Pro API for text generation
- Chrome Web Speech API for voice recognition
- Web Speech Synthesis API for voice output

### Key Components
- `content.js`: Main content script handling page interactions
- `popup.js`: Extension popup interface logic
- `background.js`: Background service worker
- Chrome Extension APIs for browser integration

### Voice Features
- Continuous recognition with wake word
- Natural speech synthesis
- Error recovery and retry mechanisms
- State management for voice interactions

## Error Handling

The extension includes robust error handling for:
- Network connectivity issues
- API access problems
- Microphone permissions
- Speech recognition errors
- Invalid API keys
- Content processing failures

## Development

### Project Structure
```
beaver-assistant/
├── manifest.json
├── background.js
├── content.js
├── popup.js
├── popup.html
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Building
1. Clone the repository
2. Install development dependencies (if any)
3. Load the extension in Chrome
4. Configure API keys

### Testing
Test the extension across different:
- Webpage types
- Network conditions
- Voice input scenarios
- Browser environments


## Acknowledgments

- Google Cloud Platform for API services
- Chrome Extension APIs
- Web Speech API contributors
- DevPost Contest Gemini API

## Support

For support, email ahmedali@ntsoft.us or open an issue in the GitHub repository.
