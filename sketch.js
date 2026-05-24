function setup() {
  // Создаем базовый холст
  let cnv = createCanvas(100, 100);
  
  // Переводим холст в абсолютное позиционирование для точного управления координатами
  cnv.style('position', 'absolute');
  
  // HTML-контейнер для интерфейса (увеличен в 2 раза: отступы 30px, ширина 270px)
  panelContainer = createDiv('');
  panelContainer.position(30, 30);
  panelContainer.style('background-color', 'rgba(0, 0, 0, 0.85)');
  panelContainer.style('padding', '16px'); 
  panelContainer.style('width', '270px'); 
  panelContainer.style('color', '#fff');
  panelContainer.style('font-family', 'sans-serif');
  panelContainer.style('font-size', '16px'); // Увеличено в 2 раза (было 8px)
  panelContainer.style('border-radius', '6px');
  panelContainer.style('z-index', '999');
  panelContainer.style('line-height', '1.1');

  // Защита от кликов и тачей сквозь меню
  panelContainer.elt.addEventListener('mousedown', (e) => { e.stopPropagation(); });
  panelContainer.elt.addEventListener('touchstart', (e) => { e.stopPropagation(); });

  // Стили для внутренних элементов также увеличены в 2 раза
  let styleSheet = createElement('style', `
    body { background-color: #1a1a1a; margin: 0; padding: 0; overflow: hidden; }
    .mini-panel input[type=range] { height: 20px; margin: 4px 0 12px 0; }
    .mini-panel button { font-size: 16px; padding: 4px 10px; background: #444; color: #FFFFFF; border: none; border-radius: 4px; cursor: pointer; }
    .mini-panel button:hover { background: #666; }
    .mini-panel select { font-size: 16px; padding: 2px; background: #333; color: #fff; border: 1px solid #555; }
    .mini-panel input[type=file] { font-size: 14px; max-width: 100%; color: #aaa; margin-bottom: 12px; }
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
  btnRow.style('margin', '12px 0'); // Было 6px

  btnReset = createButton('RESET');
  btnReset.parent(btnRow);
  btnReset.style('margin-right', '10px'); // Было 5px
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
  menuRow.style('margin-top', '8px'); // Было 4px
  
  menuImages = createSelect();
  menuImages.parent(menuRow);
  menuImages.style('width', '100%');
  menuImages.style('margin-top', '4px'); // Было 2px
  
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
