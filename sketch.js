// noprotect
let totalShapes = 13;
let tiles = []; 

let img; 
let workingImg; 
let bwImg, ditheredBase;
let rectS = 15; 
let patternIndex = 0; 
let threshold = 10;
let factor = 2; 
let selectedColor; 
let isSelected = false;
let mask = []; 

const MAX_WORKING_SIZE = 1024; 
const MAX_DISPLAY_HEIGHT = 800; 

let canvasDisplayWidth = 100;
let canvasDisplayHeight = 100;

let baseNames = ["komi", "nenets", "inkeri", "mari", "erzya_moksha", "udmurt", "magyar", "suomi", "eesti", "lappi", "khanty_mansi", "selkup", "nganasan"];
let defaultImages = ["mask.png", "hugo.jpg", "manypupuner.jpg", "me.jpeg"];

let panelContainer;
let sliderSize, sliderPattern, sliderThreshold, sliderFactor;
let btnReset, btnSave, btnUpload, menuImages;

function preload() {
  for (let i = 0; i < totalShapes; i++) {
    tiles[i] = [];
    for (let t = 0; t < 16; t++) {
      tiles[i][t] = loadImage(`./data/${baseNames[i]}_${t}.png`);
    }
  }
  img = loadImage("./data/mask.png");
}

function setup() {
  let cnv = createCanvas(100, 100);
  cnv.style('position', 'absolute');
  
  // Создаем контейнер меню
  panelContainer = createDiv('');
  panelContainer.addClass('bottom-panel');

  // Блокируем клики и тапы по меню, чтобы они не рисовали на холсте под ним
  panelContainer.elt.addEventListener('mousedown', (e) => { e.stopPropagation(); });
  panelContainer.elt.addEventListener('touchstart', (e) => { e.stopPropagation(); });

  // Внедряем CSS для адаптивного нижнего меню
  let styleSheet = createElement('style', `
    body { background-color: #1a1a1a; margin: 0; padding: 0; overflow: hidden; }
    
    .bottom-panel {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: rgba(0, 0, 0, 0.85);
      padding: 12px;
      border-radius: 12px;
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      /* Адаптивная ширина: на мобильных 95%, на десктопе подстраивается под канвас */
      width: 95%;
      max-width: 800px;
      justify-content: space-between;
      color: #fff;
      font-family: sans-serif;
      z-index: 999;
      backdrop-filter: blur(8px);
      box-shadow: 0 5px 20px rgba(0,0,0,0.5);
    }

    /* На больших экранах делаем меню компактнее */
    @media (min-width: 1024px) {
      .bottom-panel {
        padding: 8px;
        gap: 8px;
        width: auto; /* Сжимается до размера контента */
        min-width: 600px;
      }
      .control-col { min-width: 120px !important; }
    }

    .control-col {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
      min-width: 140px;
    }

    .slider-row {
      display: flex;
      flex-direction: column;
      font-size: 10px;
      font-weight: bold;
      color: #aaa;
    }

    .slider-row input[type=range] {
      margin: 4px 0 0 0;
      height: 20px;
    }

    .btn-row { display: flex; gap: 6px; }

    .bottom-panel button {
      flex: 1;
      font-size: 12px;
      padding: 8px;
      background: #333;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
    }

    .bottom-panel select {
      font-size: 12px;
      padding: 6px;
      background: #222;
      color: #fff;
      border: 1px solid #444;
      border-radius: 6px;
      width: 100%;
    }
  `);

  // Функция создания ползунков с привязкой к родителю
  function createLabeledSlider(parent, label, min, max, value, step) {
    let wrapper = createDiv(label);
    wrapper.addClass('slider-row');
    wrapper.parent(parent);
    let slider = createSlider(min, max, value, step);
    slider.parent(wrapper);
    slider.style('width', '100%');
    return slider;
  }

  // Создаем 3 колонки (в ряд)
  let col1 = createDiv('');
  col1.addClass('control-col');
  col1.parent(panelContainer);
  
  let col2 = createDiv('');
  col2.addClass('control-col');
  col2.parent(panelContainer);
  
  let col3 = createDiv('');
  col3.addClass('control-col');
  col3.parent(panelContainer);

  // --- КОЛОНКА 1 (по 2 ползунка в один столбик) ---
  sliderSize = createLabeledSlider(col1, "SIZE", 4, 60, 15, 1); 
  sliderPattern = createLabeledSlider(col1, "PATTERN", 0, 12, 0, 1);
  
  // --- КОЛОНКА 2 (по 2 ползунка в один столбик) ---
  sliderThreshold = createLabeledSlider(col2, "THRESHOLD", 1, 255, 10, 1);
  sliderFactor = createLabeledSlider(col2, "DITHER FACTOR", 1, 10, 2, 1);
  
  // --- КОЛОНКА 3 (Селект, Кнопки, Загрузка файла) ---
  menuImages = createSelect();
  menuImages.parent(col3);
  for (let i = 0; i < defaultImages.length; i++) {
    menuImages.option(defaultImages[i]);
  }
  menuImages.changed(handleMenuChange);

  let btnRow = createDiv('');
  btnRow.addClass('btn-row');
  btnRow.parent(col3);
  
  btnReset = createButton('RESET');
  btnReset.parent(btnRow);
  btnReset.mousePressed(() => { isSelected = false; });

  btnSave = createButton('SAVE');
  btnSave.parent(btnRow);
  btnSave.mousePressed(() => { triggerHighResSave(); });

  let uploadWrapper = createDiv('');
  uploadWrapper.addClass('custom-file-upload');
  uploadWrapper.parent(col3);
  btnUpload = createFileInput(handleFile);
  btnUpload.parent(uploadWrapper);
  btnUpload.style('width', '100%');

  // Привязка событий ползунков
  sliderSize.input(() => { rectS = sliderSize.value(); });
  sliderPattern.input(() => { patternIndex = sliderPattern.value(); });
  
  sliderThreshold.input(() => {
    threshold = sliderThreshold.value();
    if (isSelected) updateMask(); 
  });

  sliderFactor.input(() => {
    factor = sliderFactor.value();
    updateDitherBase();
  });

  selectedColor = color(255);
  rectS = sliderSize.value();
  patternIndex = sliderPattern.value();
  threshold = sliderThreshold.value();
  
  applyNewImage(img);
}

function draw() {
  background(0);
  
  if (!isSelected) {
    image(ditheredBase, 0, 0, width, height); 
  } else {
    renderToScreen(this);
  }
}

function renderToScreen(target) {
  target.image(bwImg, 0, 0, width, height); 

  let currentP = floor(patternIndex);
  target.imageMode(CENTER);
  
  for (let gx = 0; gx < width; gx += rectS) {
    for (let gy = 0; gy < height; gy += rectS) {
      
      let workX = floor(map(gx + rectS / 2, 0, width, 0, workingImg.width));
      let workY = floor(map(gy + rectS / 2, 0, height, 0, workingImg.height));
      
      workX = constrain(workX, 0, workingImg.width - 1);
      workY = constrain(workY, 0, workingImg.height - 1);
      
      let idx = workX + workY * workingImg.width;
      
      if (idx >= 0 && idx < mask.length && mask[idx]) {
        let tIdx = (floor(gx / rectS) % 4) + (floor(gy / rectS) % 4) * 4;
        target.image(tiles[currentP][tIdx], gx + rectS / 2, gy + rectS / 2, rectS, rectS);
      }
    }
  }
  target.imageMode(CORNER);
}

function triggerHighResSave() {
  const MAX_EXPORT_PIXELS = 4000000; 
  let exportW = img.width;
  let exportH = img.height;
  
  if (exportW * exportH > MAX_EXPORT_PIXELS) {
    let scale = sqrt(MAX_EXPORT_PIXELS / (exportW * exportH));
    exportW = floor(exportW * scale);
    exportH = floor(exportH * scale);
  }

  let exportCanvas = createGraphics(exportW, exportH);
  
  exportCanvas.image(img, 0, 0, exportW, exportH);
  
  exportCanvas.drawingContext.globalCompositeOperation = 'color';
  exportCanvas.noStroke();
  exportCanvas.fill(0); 
  exportCanvas.rect(0, 0, exportW, exportH); 
  
  exportCanvas.drawingContext.globalCompositeOperation = 'source-over'; 
  
  let currentP = floor(patternIndex);
  exportCanvas.imageMode(CENTER);
  
  let origRectS = (rectS / canvasDisplayWidth) * exportW;
  
  for (let gx = 0; gx < exportW; gx += origRectS) {
    for (let gy = 0; gy < exportH; gy += origRectS) {
      
      let workX = floor(map(gx + origRectS / 2, 0, exportW, 0, workingImg.width));
      let workY = floor(map(gy + origRectS / 2, 0, exportH, 0, workingImg.height));
      
      workX = constrain(workX, 0, workingImg.width - 1);
      workY = constrain(workY, 0, workingImg.height - 1);
      
      let idx = workX + workY * workingImg.width;
      
      if (idx >= 0 && idx < mask.length && mask[idx]) {
        let screenGridX = floor(map(gx, 0, exportW, 0, canvasDisplayWidth) / rectS);
        let screenGridY = floor(map(gy, 0, exportH, 0, canvasDisplayHeight) / rectS);
        let tIdx = (screenGridX % 4) + (screenGridY % 4) * 4;
        
        exportCanvas.image(tiles[currentP][tIdx], gx + origRectS / 2, gy + origRectS / 2, origRectS, origRectS);
      }
    }
  }
  
  let timestamp = floor(Date.now() / 1000);
  let fileName = `render_${timestamp}.png`;
  
  setTimeout(() => {
    exportCanvas.elt.toBlob(function(blob) {
      if (blob) {
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          exportCanvas.remove();
        }, 300);
      } else {
        exportCanvas.save(fileName);
        exportCanvas.remove();
      }
    }, 'image/png');
  }, 50);
}

function mousePressed(event) {
  if (touches.length > 0) return; 
  if (event && event.target && event.target.tagName.toLowerCase() !== 'canvas') return;

  handleInput(mouseX, mouseY);
}

function touchStarted(event) {
  if (event && event.target && event.target.tagName.toLowerCase() !== 'canvas') return;
  
  if (touches && touches.length > 0) {
    handleInput(touches[0].x, touches[0].y);
  }
  
  return false; 
}

function handleInput(targetX, targetY) {
  if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
    let workX = floor(map(targetX, 0, width, 0, workingImg.width));
    let workY = floor(map(targetY, 0, height, 0, workingImg.height));
    
    workX = constrain(workX, 0, workingImg.width - 1);
    workY = constrain(workY, 0, workingImg.height - 1);
    
    selectedColor = ditheredBase.get(workX, workY);
    updateMask(); 
    isSelected = true;
  }
}

function updateMask() {
  ditheredBase.loadPixels();
  let selR = red(selectedColor);
  let selG = green(selectedColor);
  let selB = blue(selectedColor);

  let len = ditheredBase.pixels.length;
  if (mask.length !== len / 4) {
    mask = new Array(len / 4).fill(false);
  }

  for (let i = 0; i < len; i += 4) {
    let r = ditheredBase.pixels[i];
    let g = ditheredBase.pixels[i + 1];
    let b = ditheredBase.pixels[i + 2];
    
    let rd = r - selR;
    let gd = g - selG;
    let bd = b - selB;
    let d = sqrt(rd*rd + gd*gd + bd*bd);
    
    mask[i / 4] = (d < threshold);
  }
}

function updateDitherBase() {
  ditheredBase = workingImg.get();
  applyFullDither(ditheredBase, factor);
  if (isSelected) updateMask();
}

function applyFullDither(p, f) {
  p.loadPixels();
  let w = p.width;
  let h = p.height;
  
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let idx = (x + y * w) * 4;
      
      let oldR = p.pixels[idx];
      let oldG = p.pixels[idx + 1];
      let oldB = p.pixels[idx + 2];
      
      let nR = Math.round(f * oldR / 255) * Math.floor(255 / f);
      let nG = Math.round(f * oldG / 255) * Math.floor(255 / f);
      let nB = Math.round(f * oldB / 255) * Math.floor(255 / f);
      
      p.pixels[idx] = nR;
      p.pixels[idx + 1] = nG;
      p.pixels[idx + 2] = nB;
      
      let errR = (oldR - nR) / 8.0;
      let errG = (oldG - nG) / 8.0;
      let errB = (oldB - nB) / 8.0;
      
      distErr(p, x + 1, y, errR, errG, errB); 
      distErr(p, x + 2, y, errR, errG, errB);
      distErr(p, x - 1, y + 1, errR, errG, errB); 
      distErr(p, x, y + 1, errR, errG, errB);
      distErr(p, x + 1, y + 1, errR, errG, errB); 
      distErr(p, x, y + 2, errR, errG, errB);
    }
  }
  p.updatePixels();
}

function distErr(p, x, y, er, eg, eb) {
  if (x >= 0 && x < p.width && y >= 0 && y < p.height) {
    let i = (x + y * p.width) * 4;
    p.pixels[i]     = Math.min(255, Math.max(0, p.pixels[i] + er));
    p.pixels[i + 1] = Math.min(255, Math.max(0, p.pixels[i + 1] + eg));
    p.pixels[i + 2] = Math.min(255, Math.max(0, p.pixels[i + 2] + eb));
  }
}

function handleFile(file) {
  if (file.type === 'image') {
    loadImage(file.data, newImg => {
      applyNewImage(newImg);
    });
  }
}

function handleMenuChange() {
  let selectedName = menuImages.value();
  loadImage(`./data/${selectedName}`, newImg => {
    applyNewImage(newImg);
  });
}

function windowResized() {
  applyNewImage(img);
}

function applyNewImage(newImg) {
  img = newImg; 
  
  workingImg = img.get();
  if (workingImg.width > MAX_WORKING_SIZE || workingImg.height > MAX_WORKING_SIZE) {
    if (workingImg.width > workingImg.height) {
      workingImg.resize(MAX_WORKING_SIZE, 0);
    } else {
      workingImg.resize(0, MAX_WORKING_SIZE);
    }
  }
  
  let imgRatio = img.width / img.height;
  canvasDisplayHeight = MAX_DISPLAY_HEIGHT;
  
  let maxAvailableWidth = windowWidth; 
  canvasDisplayWidth = Math.floor(MAX_DISPLAY_HEIGHT * imgRatio);
  
  if (canvasDisplayWidth > maxAvailableWidth) {
    canvasDisplayWidth = maxAvailableWidth;
    canvasDisplayHeight = Math.floor(canvasDisplayWidth / imgRatio);
  }
  
  resizeCanvas(canvasDisplayWidth, canvasDisplayHeight);
  
  let marginLeft = Math.floor((windowWidth - canvasDisplayWidth) / 2);
  let marginTop = Math.floor((windowHeight - canvasDisplayHeight) / 2);
  
  let canvasElement = select('canvas');
  if (canvasElement) {
    canvasElement.style('margin-left', marginLeft + 'px');
    canvasElement.style('margin-top', marginTop + 'px');
    canvasElement.style('width', canvasDisplayWidth + 'px');
    canvasElement.style('height', canvasDisplayHeight + 'px');
  }
  
  bwImg = workingImg.get();
  bwImg.filter(GRAY);
  
  mask = new Array(workingImg.width * workingImg.height).fill(false);
  isSelected = false; 
  
  updateDitherBase();
}
