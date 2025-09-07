const MAX_HISTORY_ITEMS = 30;
let blueprintHistory = [];
let jsonEditor;
let searchCursor; // Variable to hold the search cursor

function addToHistory(blueprint) {
  if (!blueprint || blueprintHistory.includes(blueprint)) return;
  
  blueprintHistory.unshift(blueprint);
  if (blueprintHistory.length > MAX_HISTORY_ITEMS) {
    blueprintHistory.pop();
  }
  updateHistoryDisplay();

  try {
    localStorage.setItem('blueprintHistory', JSON.stringify(blueprintHistory));
  } catch (e) {
    console.log("LocalStorage not available:", e);
  }
}

function updateHistoryDisplay() {
  const container = document.getElementById('historyItems');
  container.innerHTML = '';
  
  blueprintHistory.forEach((blueprint, index) => {
    const shortCode = blueprint.substring(0, 10) + '...';
    const item = document.createElement('div');
    item.className = 'history-item';
    item.textContent = shortCode;
    item.title = `Restore blueprint #${index + 1}`;
    item.onclick = () => restoreFromHistory(blueprint);
    container.appendChild(item);
  });
  
  if (blueprintHistory.length === 0) {
    const empty = document.createElement('span');
    empty.textContent = 'Пусто';
    empty.style.color = '#888';
    container.appendChild(empty);
  }
}

function clearHistory() {
  blueprintHistory = [];
  try {
    localStorage.removeItem('blueprintHistory');
  } catch (e) {
    console.log("LocalStorage not available:", e);
  }
  updateHistoryDisplay();
}

function restoreFromHistory(blueprint) {
  document.getElementById('blueprintInput').value = blueprint;
  adjustFontSize('blueprintInput');
  decodeBlueprint();
}

function loadHistory() {
  try {
    const saved = localStorage.getItem('blueprintHistory');
    if (saved) {
      blueprintHistory = JSON.parse(saved);
      updateHistoryDisplay();
    }
  } catch (e) {
    console.log("LocalStorage not available:", e);
  }
}

function adjustFontSize(elementId) {
  const element = document.getElementById(elementId);
  const contentLength = element.value.length;
  
  let fontSize = 14;
  
  if (contentLength > 5000) fontSize = 10;
  else if (contentLength > 2500) fontSize = 11;
  else if (contentLength > 1000) fontSize = 12;
  else if (contentLength > 500) fontSize = 13;
  
  element.style.fontSize = `${fontSize}px`;
}

// --- Search and Replace Functions ---

function clearSearchHighlights() {
    jsonEditor.getAllMarks().forEach(mark => mark.clear());
}
  
function searchInJson() {
  clearSearchHighlights();
  const searchTerm = document.getElementById('searchInput').value.trim();
  if (!searchTerm) {
      searchCursor = null; // Reset cursor
      return;
  };
  
  searchCursor = jsonEditor.getSearchCursor(searchTerm, {line: 0, ch: 0}, {caseFold: true});
  findNext(); // Find the first occurrence
}

function findNext() {
    if (!searchCursor) return;
    if (searchCursor.findNext()) {
        jsonEditor.setSelection(searchCursor.from(), searchCursor.to());
        jsonEditor.scrollIntoView({ from: searchCursor.from(), to: searchCursor.to() }, 50);
    } else {
        // If no more matches, loop back to the start
        searchCursor = jsonEditor.getSearchCursor(searchCursor.query, {line: 0, ch: 0}, {caseFold: true});
        if(searchCursor.findNext()) {
          jsonEditor.setSelection(searchCursor.from(), searchCursor.to());
          jsonEditor.scrollIntoView({ from: searchCursor.from(), to: searchCursor.to() }, 50);
        } else {
          alert('Совпадений не найдено!');
        }
    }
}

function findPrev() {
    if (!searchCursor) return;
    if (searchCursor.findPrevious()) {
        jsonEditor.setSelection(searchCursor.from(), searchCursor.to());
        jsonEditor.scrollIntoView({ from: searchCursor.from(), to: searchCursor.to() }, 50);
    } else {
        // If no previous matches, loop back to the end
        const lastLine = jsonEditor.lastLine();
        const lastCh = jsonEditor.getLine(lastLine).length;
        searchCursor = jsonEditor.getSearchCursor(searchCursor.query, {line: lastLine, ch: lastCh}, {caseFold: true});
         if(searchCursor.findPrevious()) {
          jsonEditor.setSelection(searchCursor.from(), searchCursor.to());
          jsonEditor.scrollIntoView({ from: searchCursor.from(), to: searchCursor.to() }, 50);
        } else {
          alert('Совпадений не найдено!');
        }
    }
}

function toggleReplaceUI() {
  const container = document.getElementById('replaceContainer');
  if (container.style.display === 'block') {
    container.style.display = 'none';
  } else {
    container.style.display = 'block';
  }
}

function replaceAll() {
  const findText = document.getElementById('replaceInput').value;
  const replaceWithText = document.getElementById('replaceWithInput').value;

  if (!findText) {
    alert('Пожалуйста, введите текст, который нужно заменить.');
    return;
  }

  const currentCode = jsonEditor.getValue();
  // Using a regular expression with the 'g' flag for a global replace
  const newCode = currentCode.replace(new RegExp(findText, 'g'), replaceWithText);

  if (currentCode === newCode) {
    alert('Текст для замены не найден.');
  } else {
    jsonEditor.setValue(newCode);
    alert('Замена завершена!');
  }
}

// --- Blueprint Functions ---

function base64ToUint8Array(base64) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function decodeBlueprint() {
  try {
    const blueprintInput = document.getElementById('blueprintInput');
    const blueprint = blueprintInput.value.trim();
    
    if (!blueprint) {
      alert('Пожалуйста, введите строку чертежа');
      return;
    }
    
    addToHistory(blueprint);
    
    const base64 = blueprint.startsWith('0') ? blueprint.slice(1) : blueprint;
    
    try {
      const byteArray = base64ToUint8Array(base64);
      const jsonString = pako.inflate(byteArray, { to: 'string' });
      const json = JSON.parse(jsonString);
      
      const formattedJson = JSON.stringify(json, null, 2);
      
      jsonEditor.setValue(formattedJson);
      adjustFontSize('blueprintInput');
      encodeBlueprintPreview(json);
      
    } catch (e) {
      throw new Error('Не удалось расшифровать чертеж: ' + e.message);
    }
  } catch (e) {
    console.error('Blueprint decoding error:', e);
    alert('Случилась ошибка: ' + e.message);
  }
}

function encodeBlueprintPreview(json) {
  try {
    const jsonString = JSON.stringify(json);
    const compressed = pako.deflate(jsonString);
    const base64 = btoa(String.fromCharCode.apply(null, compressed));
    const encodedOutput = document.getElementById('encodedOutput');
    encodedOutput.value = '0' + base64;
    adjustFontSize('encodedOutput');
  } catch (e) {
    document.getElementById('encodedOutput').value = 'Encoding error: ' + e.message;
  }
}

function encodeJson() {
  try {
    const jsonText = jsonEditor.getValue();
    
    if (!jsonText.trim()) {
      alert('JSON редактор пуст!');
      return;
    }

    const json = JSON.parse(jsonText);
    encodeBlueprintPreview(json);
    
    const formattedJson = JSON.stringify(json, null, 2);
    jsonEditor.setValue(formattedJson);

  } catch (e) {
    alert('Ошибка кодирования: Неверный формат JSON. ' + e.message);
  }
}

function copyEncodedBlueprint() {
  const encodedField = document.getElementById('encodedOutput');
  if (!encodedField.value) return;

  encodedField.select();
  navigator.clipboard.writeText(encodedField.value).then(() => {
      const copyButton = event.target;
      const originalText = copyButton.textContent;
      copyButton.textContent = 'Скопировано!';
      setTimeout(() => {
        copyButton.textContent = originalText;
      }, 1500);
  });
}

function clearBlueprint() {
  document.getElementById('blueprintInput').value = '';
}

// Initialize everything when page loads
window.onload = function() {
  jsonEditor = CodeMirror(document.getElementById('jsonEditorContainer'), {
      mode: { name: "javascript", json: true },
      theme: "material-darker",
      lineNumbers: true,
      lineWrapping: true,
      autoCloseBrackets: true,
      matchBrackets: true,
      styleActiveLine: true,
      gutters: ["CodeMirror-linenumbers"],
      highlightSelectionMatches: { showToken: /\w/, annotateScrollbar: true }
  });

  jsonEditor.setSize(null, 'auto');
  jsonEditor.refresh();

  loadHistory();
  adjustFontSize('blueprintInput');
  
  document.getElementById('blueprintInput').addEventListener('input', function() {
    adjustFontSize('blueprintInput');
  });
  
  document.getElementById('searchInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      searchInJson();
    }
  });
  
  decodeBlueprint();
};
