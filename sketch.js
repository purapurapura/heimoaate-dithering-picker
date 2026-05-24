// noprotect
let totalShapes = 13;
let tiles = []; 
let img, workingImg, bwImg, ditheredBase;
let rectS = 15; 
let patternIndex = 0; 
let threshold = 10;
let factor = 2; 
let selectedColor; 
let isSelected = false;
let mask = []; 

const MAX_WORKING_SIZE = 1024; 

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
  // Убираем position: absolute, пусть меню и холст живут в одном потоке
  let cnv = createCanvas(100, 100);
  
  // Создаем контейнер для всего, чтобы центрировать
  let container = createDiv('');
  container.style('display', 'flex');
  container.style('flex-direction', 'column');
  container.style('align-items', 'center');
  container.style('padding-bottom', '20px');
  
  cnv.parent(container);

  // Стили меню: жесткие размеры в PX, никаких процентов
  let css = `
    body { background-color: #1a1a1a; margin: 0; padding: 20px; }
    .bottom-panel {
      width: 600px;
      margin-top: 20px;
      background-color: #000;
      padding: 20px;
      border-radius: 12px;
      display: flex;
      flex-direction: row;
      gap: 20px;
      box-shadow: 0 5px 20px rgba(0,0,0,0.5);
    }
    @media (max-width: 650px) {
      .bottom-panel { width: 90%; flex-wrap: wrap; }
    }
    .control-col { display: flex; flex-direction: column; gap: 10px; flex: 1; }
    .slider-row { color: #fff; font-size: 12px; font-weight: bold; }
    input[type=range] { width: 100%; margin-top: 8px; height: 30px; }
    button { padding: 12px; background: #333; color: #fff; border: none; border-radius: 6px; cursor: pointer; }
    select { padding: 10px; background: #222; color: #fff; border: 1px solid #444; border-radius: 6px; width: 100%; }
  `;
  let style = document.createElement('style');
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);

  let panel = createDiv('').addClass('bottom-panel').parent(container);

  let col1 = createDiv('').addClass('control-col').parent(panel);
  let col2 = createDiv('').addClass('control-col').parent(panel);
  let col3 = createDiv('').addClass('control-col').parent(panel);

  sliderSize = createSlider(4, 60, 15, 1).parent(createDiv('SIZE').addClass('slider-row').parent(col1));
  sliderPattern = createSlider(0, 12, 0, 1).parent(createDiv('PATTERN').addClass('slider-row').parent(col1));
  sliderThreshold = createSlider(1, 255, 10, 1).parent(createDiv('THRESHOLD').addClass('slider-row').parent(col2));
  sliderFactor = createSlider(1, 10, 2, 1).parent(createDiv('FACTOR').addClass('slider-row').parent(col2));

  menuImages = createSelect().parent(col3);
  ["mask.png", "hugo.jpg", "manypupuner.jpg", "me.jpeg"].forEach(n => menuImages.option(n));
  menuImages.changed(handleMenuChange);

  let btnRow = createDiv('').parent(col3).style('display', 'flex').style('gap', '10px');
  createButton('RESET').parent(btnRow).mousePressed(() => isSelected = false);
  createButton('SAVE').parent(btnRow).mousePressed(triggerHighResSave);
  createFileInput(handleFile).parent(col3).style('margin-top', '5px');

  sliderSize.input(() => rectS = sliderSize.value());
  sliderPattern.input(() => patternIndex = sliderPattern.value());
  sliderThreshold.input(() => { threshold = sliderThreshold.value(); if (isSelected) updateMask(); });
  sliderFactor.input(() => { factor = sliderFactor.value(); updateDitherBase(); });

  applyNewImage(img);
}

function draw() {
  background(0);
  if (!isSelected) image(ditheredBase, 0, 0, width, height); 
  else renderToScreen(this);
}

function renderToScreen(target) {
  target.image(bwImg, 0, 0, width, height); 
  target.imageMode(CENTER);
  let currentP = floor(patternIndex);
  for (let gx = 0; gx < width; gx += rectS) {
    for (let gy = 0; gy < height; gy += rectS) {
      let wx = floor(map(gx + rectS/2, 0, width, 0, workingImg.width));
      let wy = floor(map(gy + rectS/2, 0, height, 0, workingImg.height));
      if (mask[constrain(wx, 0, workingImg.width-1) + constrain(wy, 0, workingImg.height-1) * workingImg.width]) {
        target.image(tiles[currentP][(floor(gx/rectS)%4) + (floor(gy/rectS)%4)*4], gx + rectS/2, gy + rectS/2, rectS, rectS);
      }
    }
  }
  target.imageMode(CORNER);
}

function triggerHighResSave() {
  let g = createGraphics(img.width, img.height);
  g.image(img, 0, 0);
  g.drawingContext.globalCompositeOperation = 'color';
  g.fill(0); g.rect(0, 0, img.width, img.height);
  g.drawingContext.globalCompositeOperation = 'source-over';
  g.imageMode(CENTER);
  let s = rectS * (img.width / width);
  for (let gx = 0; gx < img.width; gx += s) {
    for (let gy = 0; gy < img.height; gy += s) {
      let wx = floor(map(gx + s/2, 0, img.width, 0, workingImg.width));
      let wy = floor(map(gy + s/2, 0, img.height, 0, workingImg.height));
      if (mask[wx + wy * workingImg.width]) g.image(tiles[floor(patternIndex)][(floor(gx/s)%4) + (floor(gy/s)%4)*4], gx + s/2, gy + s/2, s, s);
    }
  }
  g.save('art.png'); g.remove();
}

function handleInput(x, y) {
  selectedColor = ditheredBase.get(floor(map(x, 0, width, 0, workingImg.width)), floor(map(y, 0, height, 0, workingImg.height)));
  updateMask(); isSelected = true;
}

function mousePressed(e) { if(e.target.tagName === 'CANVAS') handleInput(mouseX, mouseY); }
function touchStarted(e) { if(e.target.tagName === 'CANVAS') { handleInput(touches[0].x, touches[0].y); return false; } }

function updateMask() {
  ditheredBase.loadPixels();
  let [r0, g0, b0] = [red(selectedColor), green(selectedColor), blue(selectedColor)];
  mask = new Array(workingImg.width * workingImg.height);
  for (let i = 0; i < ditheredBase.pixels.length; i += 4) {
    let d = sqrt(pow(ditheredBase.pixels[i]-r0, 2) + pow(ditheredBase.pixels[i+1]-g0, 2) + pow(ditheredBase.pixels[i+2]-b0, 2));
    mask[i/4] = (d < threshold);
  }
}

function updateDitherBase() { ditheredBase = workingImg.get(); applyFullDither(ditheredBase, factor); if (isSelected) updateMask(); }

function applyFullDither(p, f) {
  p.loadPixels();
  for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
      let i = (x + y * p.width) * 4;
      let r = Math.round(f * p.pixels[i]/255) * Math.floor(255/f);
      let g = Math.round(f * p.pixels[i+1]/255) * Math.floor(255/f);
      let b = Math.round(f * p.pixels[i+2]/255) * Math.floor(255/f);
      let er = (p.pixels[i] - r)/8, eg = (p.pixels[i+1] - g)/8, eb = (p.pixels[i+2] - b)/8;
      p.pixels[i] = r; p.pixels[i+1] = g; p.pixels[i+2] = b;
      distErr(p, x+1, y, er, eg, eb); distErr(p, x+2, y, er, eg, eb);
      distErr(p, x-1, y+1, er, eg, eb); distErr(p, x, y+1, er, eg, eb);
      distErr(p, x+1, y+1, er, eg, eb); distErr(p, x, y+2, er, eg, eb);
    }
  }
  p.updatePixels();
}

function distErr(p, x, y, er, eg, eb) {
  if (x >= 0 && x < p.width && y >= 0 && y < p.height) {
    let i = (x + y * p.width) * 4;
    p.pixels[i] = constrain(p.pixels[i] + er, 0, 255);
    p.pixels[i+1] = constrain(p.pixels[i+1] + eg, 0, 255);
    p.pixels[i+2] = constrain(p.pixels[i+2] + eb, 0, 255);
  }
}

function handleFile(file) { if (file.type === 'image') loadImage(file.data, applyNewImage); }
function handleMenuChange() { loadImage(`./data/${menuImages.value()}`, applyNewImage); }
function windowResized() { applyNewImage(img); }

function applyNewImage(newImg) {
  img = newImg; workingImg = img.get();
  if (max(workingImg.width, workingImg.height) > MAX_WORKING_SIZE) workingImg.resize(MAX_WORKING_SIZE, 0);
  let ratio = img.width / img.height;
  let w = min(windowWidth - 40, 800);
  resizeCanvas(w, w / ratio);
  bwImg = workingImg.get(); bwImg.filter(GRAY);
  mask = new Array(workingImg.width * workingImg.height).fill(false);
  updateDitherBase();
}
