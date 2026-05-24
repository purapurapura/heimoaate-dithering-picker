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

// Переменные для зума и панорамирования (перетаскивания)
let imgScale = 1.0;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let startDragX, startDragY;
let startOffsetX, startOffsetY;

// Переменные для pinch-to-zoom на мобильных
let startDiag = 0;
let startScale = 1.0;

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
  // Создаем холст на всю доступную ширину и высоту окна
  let cnv = createCanvas(windowWidth, windowHeight);
  cnv.style('display', 'block');
  cnv.style('position', 'absolute');
  cnv.style('left', '0');
  cnv.style('top', '0');
  
  // HTML-контейнер для интерфейса (слева)
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
    body { background-color: #1a1a1a; margin: 0; padding: 0; overflow: hidden; }
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
  background(26); // Тот же #1a1a1a
  
  // Применяем трансформации: сдвиг в центр экрана + зум пользователя + перетаскивание
  translate(width / 2 + offsetX, height / 2 + offsetY);
  scale(imgScale);
  
  // Рисуем картинку из её центра
  imageMode(CENTER);
  if (!isSelected) {
    image(ditheredBase, 0, 0); 
  } else {
    renderToBuffer();
    image(mainRenderBuffer, 0, 0);
  }
  imageMode(CORNER);
}

// Изменение размеров окна браузера
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// Масштабирование колесиком мыши
function mouseWheel(event) {
  // Проверяем, что курсор не над меню управления
  if (mouseX < 165 && mouseY < panelContainer.size().height + 30) return;
  
  let zoomFactor = 0.1;
  if (event.delta > 0) {
    imgScale -= zoomFactor;
  } else {
    imgScale += zoomFactor;
  }
  imgScale = constrain(imgScale, 0.2, 5.0); // Ограничение зума от 20% до 500%
  return false; // Блокируем стандартный скролл страницы
}

function mousePressed(event) {
  if (touches.length > 0) return; 
  if (event && event.target && event.target.tagName.toLowerCase() !== 'canvas') return;

  // Если зажат пробел или правая кнопка мыши — активируем перетаскивание холста
  if (keyIsDown(32) || mouseButton === RIGHT) {
    isDragging = true;
    startDragX = mouseX;
    startDragY = mouseY;
    startOffsetX = offsetX;
    startOffsetY = offsetY;
  } else {
    // Обычный клик — выбираем цвет пикселя
    let coords = screenToImageCoords(mouseX, mouseY);
    handleInput(coords.x, coords.y);
  }
}

function mouseDragged() {
  if (touches.length > 0) return;
  if (isDragging) {
    offsetX = startOffsetX + (mouseX - startDragX);
    offsetY = startOffsetY + (mouseY - startDragY);
  }
}

function mouseReleased() {
  isDragging = false;
}

function touchStarted(event) {
  if (event && event.target && event.target.tagName.toLowerCase() !== 'canvas') return;
  
  if (touches && touches.length === 1) {
    // Одиночный тап — проверяем, не попали ли мы в зону меню (для мобильных)
    if (touches[0].x < 160 && touches[0].y < panelContainer.size().height + 30) return;
    
    let coords = screenToImageCoords(touches[0].x, touches[0].y);
    handleInput(coords.x, coords.y);
  } else if (touches && touches.length === 2) {
    // Двойной тап (щипок) — запоминаем стартовое расстояние для зума
    startDiag = dist(touches[0].x, touches[0].y, touches[1].x, touches[1].y);
    startScale = imgScale;
    
    // А также стартовую точку для перетаскивания двумя пальцами
    isDragging = true;
    startDragX = (touches[0].x + touches[1].x) / 2;
    startDragY = (touches[0].y + touches[1].y) / 2;
    startOffsetX = offsetX;
    startOffsetY = offsetY;
  }
  return false;
}

function touchMoved(event) {
  if (event && event.target && event.target.tagName.toLowerCase() !== 'canvas') return;

  if (touches && touches.length === 2 && isDragging) {
    // Рассчитываем мобильный зум
    let newDiag = dist(touches[0].x, touches[0].y, touches[1].x, touches[1].y);
    if (startDiag > 0) {
      imgScale = startScale * (newDiag / startDiag);
      imgScale = constrain(imgScale, 0.2, 5.0);
    }
    
    // Рассчитываем мобильный сдвиг двумя пальцами
    let currentDragX = (touches[0].x + touches[1].x) / 2;
    let currentDragY = (touches[0].y + touches[1].y) / 2;
    offsetX = startOffsetX + (currentDragX - startDragX);
    offsetY = startOffsetY + (currentDragY - startDragY);
  }
  return false;
}

function touchEnded() {
  isDragging = false;
  startDiag = 0;
}

// Функция перевода экранных координат мыши/тача в реальные координаты пикселей картинки
function screenToImageCoords(screenX, screenY) {
  // Разворачиваем матрицу трансформаций обратно
  let imgX = (screenX - width / 2 - offsetX) / imgScale;
  let imgY = (screenY - height / 2 - offsetY) / imgScale;
  
  // Сдвигаем координаты, так как картинка рисуется из центра (CENTER)
  imgX += img.width / 2;
  imgY += img.height / 2;
  
  return { x: imgX, y: imgY };
}

function handleInput(targetX, targetY) {
  if (targetX >= 0 && targetX < img.width && targetY >= 0 && targetY < img.height) {
    let origX = floor(targetX);
    let origY = floor(targetY);
    
    origX = constrain(origX, 0, img.width - 1);
    origY = constrain(origY, 0, img.height - 1);
    
    selectedColor = ditheredBase.get(origX, origY);
    updateMask(); 
    isSelected = true;
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
  
  // Сбрасываем трансформации при загрузке новой картинки
  imgScale = 1.0;
  offsetX = 0;
  offsetY = 0;
  
  // Автоматический подбор масштаба, чтобы картинка красиво влезала в экран по умолчанию
  let padding = 40;
  let scaleW = (windowWidth - 180 - padding) / img.width;
  let scaleH = (windowHeight - padding) / img.height;
  imgScale = Math.min(scaleW, scaleH, 1.0); // Сильно маленькие не увеличиваем больше 100%
  
  mainRenderBuffer = createGraphics(img.width, img.height);
  
  bwImg = img.get();
  bwImg.filter(GRAY);
  
  mask = new Array(img.width * img.height).fill(false);
  isSelected = false; 
  
  updateDitherBase();
}
