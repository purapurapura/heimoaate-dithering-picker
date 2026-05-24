// noprotect
let totalShapes = 13;
let tiles = []; 

let img, bwImg, ditheredBase;
let rectS = 15;
let patternIndex = 0; 
let threshold = 10;
let factor = 2; 
let selectedColor; 
let isSelected = false;
let mask = []; 

// Настройка максимальной высоты окна НА ЭКРАНЕ
const MAX_DISPLAY_HEIGHT = 800; 

// Текущие экранные размеры холста (для draw и mouse)
let canvasDisplayWidth = 100;
let canvasDisplayHeight = 100;

let baseNames = ["komi", "nenets", "inkeri", "mari", "erzya_moksha", "udmurt", "magyar", "suomi", "eesti", "lappi", "khanty_mansi", "selkup", "nganasan"];
let defaultImages = ["mask.png", "hugo.jpg", "manypupuner.jpg", "me.jpeg"];

let panelContainer;
let sliderSize, sliderPattern, sliderThreshold, sliderFactor;
let btnReset, btnSave, btnUpload, menuImages;

// Буферы для рендеринга в оригинальном качестве
let mainRenderBuffer; 

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
  // Создаем базовый холст
  let cnv = createCanvas(100, 100);
  
  // Сдвигаем сам холст на экране вправо на ширину меню + отступы (135px + 30px = 165px)
  cnv.style('margin-left', '165px');
  cnv.style('margin-top', '15px');
  
  // HTML-контейнер для интерфейса (закреплен жестко слева в углу)
  panelContainer = createDiv('');
  panelContainer.position(15, 15);
  panelContainer.style('background-color', 'rgba(0, 0, 0, 0.85)');
  panelContainer.style('padding', '8px'); 
  panelContainer.style('width', '135px'); 
  panelContainer.style('color', '#fff');
  panelContainer.style('font-family', 'sans-serif');
  panelContainer.style('font-size', '8px'); 
  panelContainer.style('border-radius', '3px');
  panelContainer.style('z-index', '999');
  panelContainer.style('line-height', '1.1');

  // Защита от кликов и тачей сквозь меню
  panelContainer.elt.addEventListener('mousedown', (e) => { e.stopPropagation(); });
  panelContainer.elt.addEventListener('touchstart', (e) => { e.stopPropagation(); });

  let styleSheet = createElement('style', `
    body { background-color: #1a1a1a; margin: 0; padding: 0; }
    .mini-panel input[type=range] { height: 10px; margin: 2px 0 6px 0; }
    .mini-panel button { font-size: 8px; padding: 2px 5px; background: #444; color: #FFFFFF; border: none; border-radius: 2px; cursor: pointer; }
    .mini-panel button:hover { background: #666; }
    .mini-panel select { font-size: 8px; padding: 1px; background: #333; color: #fff; border: 1px solid #555; }
    .mini-panel input[type=file] { font-size: 7px; max-width: 100%; color: #aaa; margin-bottom: 6px; }
  `);
  panelContainer.addClass('mini-panel');

  function createLabeledSlider(label, min, max, value, step) {
    let panelRow = createDiv(label + ': ');
    panelRow.parent(panelContainer);
    let slider = createSlider(min, max, value, step);
    slider.parent(panelRow);
    slider.style('width', '100%');
    return slider;
  }

  sliderSize = createLabeledSlider("SIZE", 4, 30, 15, 1); 
  sliderPattern = createLabeledSlider("PATTERN", 0, 12, 0, 1);
  sliderThreshold = createLabeledSlider("THRESHOLD", 1, 255, 10, 1);
  sliderFactor = createLabeledSlider("DITHER FACTOR", 1, 10, 2, 1);
  
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

  let btnRow = createDiv('');
  btnRow.parent(panelContainer);
  btnRow.style('margin', '6px 0');

  btnReset = createButton('RESET');
  btnReset.parent(btnRow);
  btnReset.style('margin-right', '5px');
  btnReset.mousePressed(() => { isSelected = false; });

  btnSave = createButton('SAVE');
  btnSave.parent(btnRow);
  btnSave.mousePressed(() => {
    let timestamp = floor(Date.now() / 1000);
    renderToBuffer();
    save(mainRenderBuffer, `render_${timestamp}.png`);
  });

  btnUpload = createFileInput(handleFile);
  btnUpload.parent(panelContainer);

  let menuRow = createDiv('SELECT IMAGE:<br>');
  menuRow.parent(panelContainer);
  menuRow.style('margin-top', '4px');
  
  menuImages = createSelect();
  menuImages.parent(menuRow);
  menuImages.style('width', '100%');
  menuImages.style('margin-top', '2px');
  
  for (let i = 0; i < defaultImages.length; i++) {
    menuImages.option(defaultImages[i]);
  }
  menuImages.changed(handleMenuChange);

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
    renderToBuffer();
    image(mainRenderBuffer, 0, 0, width, height);
  }
}

function renderToBuffer() {
  mainRenderBuffer.clear();
  mainRenderBuffer.image(bwImg, 0, 0); 

  let currentP = floor(patternIndex);
  mainRenderBuffer.imageMode(CENTER);
  
  for (let gx = 0; gx < img.width; gx += rectS) {
    for (let gy = 0; gy < img.height; gy += rectS) {
      let checkX = floor(gx + rectS / 2);
      let checkY = floor(gy + rectS / 2);
      let idx = checkX + checkY * img.width;
      
      if (idx >= 0 && idx < mask.length && mask[idx]) {
        let tIdx = (floor(gx / rectS) % 4) + (floor(gy / rectS) % 4) * 4;
        mainRenderBuffer.image(tiles[currentP][tIdx], gx + rectS / 2, gy + rectS / 2, rectS, rectS);
      }
    }
  }
  mainRenderBuffer.imageMode(CORNER);
}

// Обработка клика мыши
function mousePressed(event) {
  // Игнорируем тачи (чтобы не было дубля) и клики мимо холста (по меню)
  if (touches.length > 0) return; 
  if (event && event.target && event.target.tagName.toLowerCase() !== 'canvas') return;

  handleInput(mouseX, mouseY);
}

// Обработка мобильного тача
function touchStarted(event) {
  // Если тапнули по нашему меню (слайдерам, кнопкам), разрешаем им работать
  if (event && event.target && event.target.tagName.toLowerCase() !== 'canvas') return;
  
  if (touches && touches.length > 0) {
    // Больше ничего не вычитаем — p5.js сам отдает координаты внутри холста!
    handleInput(touches[0].x, touches[0].y);
  }
  
  return false; // Блокируем скролл страницы только при таппе по самому холсту
}

// Единый алгоритм расчета маски
function handleInput(targetX, targetY) {
  if (targetX >= 0 && targetX < width && targetY >= 0 && targetY < height) {
    let origX = floor(map(targetX, 0, width, 0, img.width));
    let origY = floor(map(targetY, 0, height, 0, img.height));
    
    // Подстраховка от выхода за границы картинки
    origX = constrain(origX, 0, img.width - 1);
    origY = constrain(origY, 0, img.height - 1);
    
    selectedColor = ditheredBase.get(origX, origY);
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
  ditheredBase = img.get();
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

function applyNewImage(newImg) {
  img = newImg; 
  
  let imgRatio = img.width / img.height;
  canvasDisplayHeight = MAX_DISPLAY_HEIGHT;
  
  let maxAvailableWidth = windowWidth - 190; 
  canvasDisplayWidth = Math.floor(MAX_DISPLAY_HEIGHT * imgRatio);
  
  if (canvasDisplayWidth > maxAvailableWidth) {
    canvasDisplayWidth = maxAvailableWidth;
    canvasDisplayHeight = Math.floor(canvasDisplayWidth / imgRatio);
  }
  
  resizeCanvas(canvasDisplayWidth, canvasDisplayHeight);
  
  mainRenderBuffer = createGraphics(img.width, img.height);
  
  bwImg = img.get();
  bwImg.filter(GRAY);
  
  mask = new Array(img.width * img.height).fill(false);
  isSelected = false; 
  
  updateDitherBase();
}
