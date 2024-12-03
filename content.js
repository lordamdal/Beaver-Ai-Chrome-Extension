// Content script for Beaver Assistant
let recognition = null;
let isListening = false;
let responseContainer = null;

// Voice configuration
const VOICE_SETTINGS = {
  name: 'Samantha',
  backupNames: ['Karen', 'Victoria', 'Moira'],
  rate: 0.95,
  pitch: 1.05,
  volume: 1.0
};

// Conversation state
let conversationContext = {
  isProcessing: false,
  lastCommand: null,
  awaitingResponse: false,
  isSpeaking: false
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', initialize);

// Message listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'toggleVoiceRecognition':
      handleVoiceToggle(request.isListening)
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ error: error.message }));
      return true;

    case 'summarizePage':
      handleSummarize(request.apiKey)
        .then(response => sendResponse(response))
        .catch(error => sendResponse({ error: error.message }));
      return true;

    case 'checkStatus':
      sendResponse({ isInitialized: true });
      return true;

    case 'stopSpeaking':
      stopSpeaking();
      sendResponse({ success: true });
      return true;
  }
});

// Initialize function
async function initialize() {
  try {
    createResponseContainer();
    if (document.readyState === 'complete') {
      await initializeAudio();
    } else {
      window.addEventListener('load', initializeAudio);
    }
  } catch (error) {
    console.error('Initialization error:', error);
  }
}

// Initialize audio
async function initializeAudio() {
  try {
    if (!navigator.mediaDevices) {
      throw new Error('Media devices not supported');
    }
  } catch (error) {
    console.error('Audio initialization error:', error);
  }
}

// Stop all speech
function stopSpeaking() {
  window.speechSynthesis.cancel();
  conversationContext.isSpeaking = false;
  chrome.runtime.sendMessage({ action: 'speechEnded' });
}

// Handle voice toggle
async function handleVoiceToggle(shouldListen) {
  try {
    if (shouldListen) {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      await startVoiceRecognition(stream);
      return { success: true, status: 'Voice recognition started' };
    } else {
      stopVoiceRecognition();
      return { success: true, status: 'Voice recognition stopped' };
    }
  } catch (error) {
    console.error('Voice toggle error:', error);
    stopVoiceRecognition();
    throw error;
  }
}

// Start voice recognition
async function startVoiceRecognition(stream) {
  try {
    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported');
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      showResponse('Listening...', 'info');
    };

    recognition.onend = handleVoiceEnd;
    recognition.onerror = handleVoiceError;
    recognition.onresult = handleVoiceResult;

    recognition.start();
    conversationContext.isSpeaking = true;
    await speakText("I'm ready to help.");
    chrome.runtime.sendMessage({ action: 'speechStarted' });
  } catch (error) {
    console.error('Start recognition error:', error);
    throw error;
  }
}

// Handle voice result
async function handleVoiceResult(event) {
  try {
    const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
    console.log('Transcript:', transcript);

    if (conversationContext.isProcessing) return;

    if (transcript.includes('hey beaver') || transcript.includes('beaver')) {
      conversationContext.isProcessing = true;
      const command = transcript.replace(/hey beaver|beaver/gi, '').trim();

      if (!command) {
        conversationContext.isSpeaking = true;
        chrome.runtime.sendMessage({ action: 'speechStarted' });
        await speakText("Hi! How can I help you?");
        conversationContext.awaitingResponse = true;
      } else {
        conversationContext.isSpeaking = true;
        chrome.runtime.sendMessage({ action: 'speechStarted' });
        await speakText("I'll help you with that.");
        showResponse('Processing: ' + command, 'info');

        const { gcpApiKey } = await chrome.storage.local.get(['gcpApiKey']);
        if (!gcpApiKey) {
          throw new Error('API key not found');
        }

        const response = await chrome.runtime.sendMessage({
          action: 'processCommand',
          command: command,
          content: document.body.innerText
        });

        if (response.error) {
          throw new Error(response.error);
        }

        const responseText = response.response || response.summary || 'Command processed';
        showResponse(responseText, 'success');

        const sentences = responseText.match(/[^.!?]+[.!?]+/g) || [responseText];
        for (const sentence of sentences) {
          if (!conversationContext.isSpeaking) break;
          await speakText(sentence.trim());
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        if (conversationContext.isSpeaking) {
          setTimeout(async () => {
            await speakText("Is there anything else you'd like me to help you with?");
            conversationContext.awaitingResponse = true;
          }, 1000);
        }
      }
    } else if (conversationContext.awaitingResponse) {
      if (transcript.includes('no') || transcript.includes('that\'s all') || transcript.includes('thank you')) {
        conversationContext.isSpeaking = true;
        chrome.runtime.sendMessage({ action: 'speechStarted' });
        await speakText("Alright, just let me know if you need anything else!");
        conversationContext.awaitingResponse = false;
      } else if (transcript.includes('yes') || transcript.includes('yeah')) {
        conversationContext.isSpeaking = true;
        chrome.runtime.sendMessage({ action: 'speechStarted' });
        await speakText("Sure, what would you like me to do?");
        conversationContext.awaitingResponse = true;
      }
    }
  } catch (error) {
    console.error('Voice result error:', error);
    showResponse('Error: ' + error.message, 'error');
    conversationContext.isSpeaking = true;
    chrome.runtime.sendMessage({ action: 'speechStarted' });
    await speakText("I'm sorry, I encountered an error. Please try again.");
  } finally {
    conversationContext.isProcessing = false;
    chrome.runtime.sendMessage({ action: 'speechEnded' });
  }
}

// Handle voice error
function handleVoiceError(event) {
  if (event.error === 'no-speech') {
    console.log('No speech detected');
    return;
  }
  console.error('Recognition error:', event.error);
  showResponse(`Voice recognition error: ${event.error}`, 'error');
  isListening = false;
  chrome.runtime.sendMessage({ action: 'speechEnded' });
}

// Handle voice end
function handleVoiceEnd() {
  if (isListening && recognition) {
    setTimeout(() => {
      try {
        recognition.start();
      } catch (error) {
        console.error('Restart recognition error:', error);
      }
    }, 100);
  }
}

// Stop voice recognition
function stopVoiceRecognition() {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
  isListening = false;
  stopSpeaking();
  showResponse('Voice recognition stopped', 'info');
}

// Handle summarization
async function handleSummarize(apiKey) {
  try {
    if (!apiKey) {
      throw new Error('API key is required');
    }

    showResponse('Working on your summary...', 'info');
    conversationContext.isSpeaking = true;
    chrome.runtime.sendMessage({ action: 'speechStarted' });
    await speakText("I'll summarize this page for you, just a moment.");

    const response = await chrome.runtime.sendMessage({
      action: 'processSummary',
      content: document.body.innerText.substring(0, 5000),
      apiKey: apiKey
    });

    if (response.error) {
      throw new Error(response.error);
    }

    showResponse(response.summary, 'success');

    const paragraphs = response.summary.split('\n').filter(p => p.trim());
    for (const paragraph of paragraphs) {
      if (!conversationContext.isSpeaking) break;
      await speakText(paragraph.trim());
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (conversationContext.isSpeaking) {
      setTimeout(async () => {
        await speakText("Would you like me to explain any part in more detail?");
        conversationContext.awaitingResponse = true;
      }, 1000);
    }

    return { success: true };
  } catch (error) {
    console.error('Summarize error:', error);
    showResponse('Error: ' + error.message, 'error');
    if (conversationContext.isSpeaking) {
      await speakText("I'm sorry, I couldn't create the summary. Please try again.");
    }
    throw error;
  } finally {
    chrome.runtime.sendMessage({ action: 'speechEnded' });
  }
}

// Speech synthesis
async function speakText(text) {
  return new Promise((resolve, reject) => {
    try {
      if (!conversationContext.isSpeaking) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          setVoiceAndSpeak(utterance, text, resolve, reject);
        };
      } else {
        setVoiceAndSpeak(utterance, text, resolve, reject);
      }
    } catch (error) {
      console.error('Speech synthesis error:', error);
      reject(error);
    }
  });
}

// Set voice and speak
function setVoiceAndSpeak(utterance, text, resolve, reject) {
  try {
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = voices.find(voice => 
      voice.name.includes(VOICE_SETTINGS.name) && voice.lang.startsWith('en')
    );

    if (!selectedVoice) {
      for (const backupName of VOICE_SETTINGS.backupNames) {
        selectedVoice = voices.find(voice => 
          voice.name.includes(backupName) && voice.lang.startsWith('en')
        );
        if (selectedVoice) break;
      }
    }

    if (!selectedVoice) {
      selectedVoice = voices.find(voice => voice.lang === 'en-US') ||
                     voices.find(voice => voice.lang.startsWith('en'));
    }

    utterance.voice = selectedVoice;
    utterance.rate = VOICE_SETTINGS.rate;
    utterance.pitch = VOICE_SETTINGS.pitch;
    utterance.volume = VOICE_SETTINGS.volume;

    utterance.onend = () => {
      if (conversationContext.isSpeaking) {
        resolve();
      }
    };

    utterance.onerror = (error) => {
      console.error('Speech error:', error);
      reject(error);
    };

    window.speechSynthesis.speak(utterance);

    // Chrome bug workaround
    const maxDuration = text.length * 75;
    setTimeout(() => {
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, maxDuration);

  } catch (error) {
    console.error('Voice setup error:', error);
    reject(error);
  }
}

// Show response
function showResponse(text, type = 'info') {
  if (!responseContainer) {
    responseContainer = createResponseContainer();
  }
  
  responseContainer.innerHTML = `
    <div class="beaver-response ${type}">
      <div class="beaver-header">
        <span>Beaver Assistant</span>
        <button onclick="this.parentElement.parentElement.parentElement.style.display='none'">×</button>
      </div>
      <div class="beaver-content">${text}</div>
    </div>
  `;
  
  responseContainer.style.display = 'block';
}

// Create response container
function createResponseContainer() {
  const container = document.createElement('div');
  container.id = 'beaver-response-container';
  
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 300px;
    z-index: 2147483647;
    background: white;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    font-family: system-ui, -apple-system, sans-serif;
    display: none;
  `;
  
  document.body.appendChild(container);
  return container;
}