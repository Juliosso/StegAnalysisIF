// Navigation Manager
function switchView(viewId, btnElement) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  
  document.getElementById(viewId).classList.add('active');
  if (btnElement) {
    btnElement.classList.add('active');
  }
}

// --- ENCODE LOGIC (LSB) ---
const encodeFileInput = document.getElementById('encodeFileInput');
const encodeUploadBox = document.getElementById('encodeUploadBox');
const encodePreview = document.getElementById('encodePreview');
const encodeBtn = document.getElementById('encodeBtn');
const secretMessageInput = document.getElementById('secretMessage');

// Drag and drop handlers for Encoder
encodeUploadBox.addEventListener('dragover', e => { e.preventDefault(); encodeUploadBox.classList.add('dragover'); });
encodeUploadBox.addEventListener('dragleave', () => encodeUploadBox.classList.remove('dragover'));
encodeUploadBox.addEventListener('drop', e => {
  e.preventDefault();
  encodeUploadBox.classList.remove('dragover');
  if(e.dataTransfer.files.length) {
    encodeFileInput.files = e.dataTransfer.files;
    handleEncodeFileSelect();
  }
});

encodeFileInput.addEventListener('change', handleEncodeFileSelect);
secretMessageInput.addEventListener('input', updateEncodeButtonState);

function handleEncodeFileSelect() {
  const file = encodeFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    encodePreview.src = e.target.result;
    encodePreview.style.display = 'inline-block';
    updateEncodeButtonState();
  };
  reader.readAsDataURL(file);
}

function updateEncodeButtonState() {
  encodeBtn.disabled = !(encodeFileInput.files.length > 0 && secretMessageInput.value.trim().length > 0);
}

function encodeData() {
  const file = encodeFileInput.files[0];
  const message = secretMessageInput.value;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imgData.data;

      const fullMessage = message + "###END###";
      let binaryMessage = "";
      for (let i = 0; i < fullMessage.length; i++) {
        let bin = fullMessage.charCodeAt(i).toString(2).padStart(8, '0');
        binaryMessage += bin;
      }

      if (binaryMessage.length > pixels.length * 0.75) {
        alert("The secret message is too long for this image dimensions!");
        return;
      }

      // Apply LSB bit injection on RGB channels
      let dataIndex = 0;
      for (let i = 0; i < pixels.length; i++) {
        if ((i + 1) % 4 === 0) continue; // Skip alpha channel
        if (dataIndex < binaryMessage.length) {
          pixels[i] = (pixels[i] & ~1) | parseInt(binaryMessage[dataIndex]);
          dataIndex++;
        } else {
          break;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      
      const dataUrl = canvas.toDataURL('image/png');
      const downloadLink = document.getElementById('downloadLink');
      downloadLink.href = dataUrl;
      
      const resultBox = document.getElementById('encodeResult');
      resultBox.className = "result-box success";
      resultBox.textContent = "Success! Your confidential message has been securely hidden inside the image pixels.";
      resultBox.style.display = "block";
      document.getElementById('downloadContainer').style.display = "block";
    }
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}


// --- DECODE & STEGANALYSIS LOGIC ---
const decodeFileInput = document.getElementById('decodeFileInput');
const decodeUploadBox = document.getElementById('decodeUploadBox');
const decodePreview = document.getElementById('decodePreview');
const decodeBtn = document.getElementById('decodeBtn');

decodeUploadBox.addEventListener('dragover', e => { e.preventDefault(); decodeUploadBox.classList.add('dragover'); });
decodeUploadBox.addEventListener('dragleave', () => decodeUploadBox.classList.remove('dragover'));
decodeUploadBox.addEventListener('drop', e => {
  e.preventDefault();
  decodeUploadBox.classList.remove('dragover');
  if(e.dataTransfer.files.length) {
    decodeFileInput.files = e.dataTransfer.files;
    handleDecodeFileSelect();
  }
});

decodeFileInput.addEventListener('change', handleDecodeFileSelect);

function handleDecodeFileSelect() {
  const file = decodeFileInput.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    decodePreview.src = e.target.result;
    decodePreview.style.display = 'inline-block';
    decodeBtn.disabled = false;
  };
  reader.readAsDataURL(file);
}

function decodeAndAnalyze() {
  const file = decodeFileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imgData.data;

      // 1. Steganalysis Calculation (LSB Randomness / Transition Rate)
      let lsbSum = 0;
      let totalSampled = 0;
      let lsbChanges = 0;
      let lastBit = -1;

      for (let i = 0; i < pixels.length; i++) {
        if ((i + 1) % 4 === 0) continue;
        let currentBit = pixels[i] & 1;
        lsbSum += currentBit;
        if (lastBit !== -1 && currentBit !== lastBit) {
          lsbChanges++;
        }
        lastBit = currentBit;
        totalSampled++;
      }

      let randomnessRatio = lsbChanges / totalSampled;
      
      // 2. Extract Hidden Payload
      let binaryString = "";
      let extractedMessage = "";
      let foundEnd = false;

      for (let i = 0; i < pixels.length; i++) {
        if ((i + 1) % 4 === 0) continue;
        binaryString += (pixels[i] & 1).toString();

        if (binaryString.length === 8) {
          let charCode = parseInt(binaryString, 2);
          extractedMessage += String.fromCharCode(charCode);
          binaryString = "";

          if (extractedMessage.endsWith("###END###")) {
            extractedMessage = extractedMessage.replace("###END###", "");
            foundEnd = true;
            break;
          }
          if (extractedMessage.length > 5000) break;
        }
      }

      const resultBox = document.getElementById('decodeResult');
      resultBox.style.display = "block";

      let analysisText = `--- Steganalysis & Statistics ---\n`;
      analysisText += `• LSB Randomness Score: ${(randomnessRatio * 100).toFixed(1)}%\n`;

      let statusClass = "success";
      if (foundEnd && extractedMessage.length > 0) {
        statusClass = "danger";
        analysisText += `• Status: ❌ Hidden data payload detected!\n\n`;
        analysisText += `Extracted Secret Message:\n"${extractedMessage}"`;
      } else if (randomnessRatio > 0.48 && randomnessRatio < 0.52) {
        statusClass = "warning";
        analysisText += `• Status: ⚠️ Suspicious patterns found (potential LSB payload, but no valid terminator structure matched).`;
      } else {
        statusClass = "success";
        analysisText += `• Status: ✅ No strong indications of hidden LSB modifications found.`;
      }

      resultBox.className = "result-box " + statusClass;
      resultBox.textContent = analysisText;
    }
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}