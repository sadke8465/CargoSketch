// sketch.js

// --------------------------------------------------------------------------
// HELPER FUNCTIONS & GLOBAL DETECTION
// --------------------------------------------------------------------------

// 1) Detect if mobile device (simple check)
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone|Opera Mini|Mobile/i.test(navigator.userAgent);
}

// 2) Easing
function easeInOutQuad(t) {
  if (t < 0.5) return 2 * t * t;
  return -1 + (4 - 2 * t) * t;
}
function lerpAngle(a0, a1, amt) {
  return a0 + (a1 - a0) * amt;
}

// 3) Substring finder for desktop highlight
function findExactSubstringIndices(fullText, sub) {
  let result = [];
  let matchIndex = 0;
  let subLen = sub.length;

  for (let i = 0; i < fullText.length; i++) {
    if (matchIndex >= subLen) break;
    let cFull = fullText[i];
    let cSub = sub[matchIndex];
    if (cFull.toLowerCase() === cSub.toLowerCase()) {
      result.push(i);
      matchIndex++;
    }
  }
  return result;
}

// 4) Check if point is inside the interactive area (desktop)
function isInsideInteractiveArea(mx, my) {
  return (mx >= leftPanelX && mx <= leftPanelX + leftPanelW &&
          my >= leftPanelY && my <= leftPanelY + leftPanelH);
}

// --------------------------------------------------------------------------
// MATTER.JS ALIASES
// --------------------------------------------------------------------------
const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;

// --------------------------------------------------------------------------
// GLOBAL VARIABLES FOR MODES
// --------------------------------------------------------------------------
let MOBILE_MODE = false;

// We store references to our Matter.js engines/worlds
let desktopEngine, desktopWorld;
let mobileEngine, mobileWorld;

// --------------------------------------------------------------------------
// DESKTOP MODE GLOBALS
// --------------------------------------------------------------------------

// We'll define references used in Desktop mode:
let wallComposite;
let centerArrowBall;
let previewBody;
let oldMousePos = { x: 0, y: 0 };

// IMPORTANT: Define ghostBallScale here to avoid ReferenceError
let ghostBallScale = 0; // starts invisible

// Desktop phrase / highlight
let phrase = 
`Hey, I’m Noam Sadi, a 
multidisciplinary designer.

Looking for a place to grow.`;
let substringToHighlight = "NoamSadi"; 
let highlightIndices = [];
let letterAlphas = [];
let letterSpawnTimes = [];
let fadeInDuration = 0.15;
let phraseIndex = 0;

// Layout references
const refW = 1728;
const refH = 1117;
const leftPanelRefW = 500;
const leftPanelRefH = 770;
const rightPanelRefW = 770;
const rightPanelRefH = 770;
const gapRef = 32;
const marginLeftRightRef = 213;
const marginTopBottomRef = 174;

let scaleFactor;
let containerW, containerH, containerX, containerY;
let leftPanelX, leftPanelY, leftPanelW, leftPanelH;
let rightPanelX, rightPanelY, rightPanelW, rightPanelH;
let phraseX, phraseY, phrasePadding;
let leftPanelCenterX, leftPanelCenterY;

// Desktop offsets & velocity
let ghostBallOffset = { x: 10, y: 10 };
let ballSpawnOffset = { x: 7, y: 7 };
let ballInitialVelocitySpeed = 7;
let ballInitialVelocityAngle;
let ballInitialVelocityAngleMAX = -70;
let ballInitialVelocityAngleMIN = -120;

let desktopBalls = [];
let isFadingBalls = false;
let fadeBallsStartTime = 1.5;
let fadeBallsDuration = 0.1;

// Desktop colors
let backgroundColor = [230];
let phraseTextColor = [0];
let highlightBallFill = [70,200,70];
let highlightTextFill = [255];
let defaultBallFill = [170];
let defaultTextFill = [0];
let arrowCircleColor = [80];
let arrowGlyphColor  = [255];
let ghostBallFill    = [127, 50];
let ghostTextFill    = [0, 50];
let interactiveOutlineColor = [170];

// Desktop physics
let physicsConfigDesktop = {
  gravity: 0.8,
  friction: 0.01,
  airDrag: 0.0,
  density: 0.01,
  restitution: 0.8
};
let arrowEaseDuration = 0.5;

// --------------------------------------------------------------------------
// MOBILE MODE GLOBALS
// --------------------------------------------------------------------------
let mobileBalls = [];     // We'll store the 24 "NOAMSADI" letters
let mobileCircleBody;     // A large static circle in the center
let deviceWalls;          // The walls at the edges of the mobile screen
let mobileGravityScale = 0.002; // Tweak to control tilt sensitivity

// We'll store the text that appears in the circle
let mobileCircleText = `This site is best viewed on a desktop device

☺

Click here to contact`;

// --------------------------------------------------------------------------
// p5.js & Font
// --------------------------------------------------------------------------
let myFont;
function preload() {
  myFont = loadFont("Geist UltraLight.otf");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont(myFont);

  // Check if mobile
  MOBILE_MODE = isMobileDevice();

  if (MOBILE_MODE) {
    setupMobile();
  } else {
    setupDesktop();
  }
}

function draw() {
  background(...backgroundColor);

  if (MOBILE_MODE) {
    drawMobile();
  } else {
    drawDesktop();
  }
}

// ===========================================================================
// DESKTOP MODE
// ===========================================================================
function setupDesktop() {
  // Create the Matter.js engine
  desktopEngine = Engine.create();
  desktopWorld = desktopEngine.world;
  desktopEngine.world.gravity.y = physicsConfigDesktop.gravity;

  // Initialize letter fade values
  for (let i = 0; i < phrase.length; i++) {
    letterAlphas[i] = 51;
    letterSpawnTimes[i] = null;
  }
  // Find highlight indices
  highlightIndices = findExactSubstringIndices(phrase, substringToHighlight);

  updateLayout(); // compute layout variables

  // Create walls for the left panel
  wallComposite = createRectWalls(leftPanelCenterX, leftPanelCenterY, leftPanelW, leftPanelH);
  World.add(desktopWorld, wallComposite);

  // Create center arrow ball
  centerArrowBall = new CenterArrowBall(leftPanelCenterX, leftPanelCenterY, 40 * scaleFactor);
  World.add(desktopWorld, centerArrowBall.body);

  // Create ghost ball
  previewBody = Bodies.circle(
    mouseX - ghostBallOffset.x, 
    mouseY - ghostBallOffset.y, 
    35 * scaleFactor, {
      restitution: 1.5,
      frictionAir: 0,
      inertia: Infinity
    }
  );
  World.add(desktopWorld, previewBody);
  
  oldMousePos.x = mouseX - ghostBallOffset.x;
  oldMousePos.y = mouseY - ghostBallOffset.y;
}

function drawDesktop() {
  // Two panels
  noStroke();
  fill(255, 255, 0);
  rect(leftPanelX, leftPanelY, leftPanelW, leftPanelH);
  fill(255);
  rect(rightPanelX, rightPanelY, rightPanelW, rightPanelH);

  // Update engine
  Engine.update(desktopEngine);

  // Update ghost ball
  updateGhostBallDesktop();
  updateGhostBallScaleDesktop();

  // Fade out logic
  let fadeBallsAlpha = 1;
  if (isFadingBalls) {
    let nowSec = millis() / 1000;
    let t = (nowSec - fadeBallsStartTime) / fadeBallsDuration;
    if (t >= 1) {
      // Remove all
      for (let lb of desktopBalls) {
        World.remove(desktopWorld, lb.body);
      }
      desktopBalls = [];
      phraseIndex = 0;
      for (let i = 0; i < phrase.length; i++) {
        letterAlphas[i] = 51;
        letterSpawnTimes[i] = null;
      }
      isFadingBalls = false;
      centerArrowBall.setTargetToMouse();
    } else {
      fadeBallsAlpha = 1 - t; 
    }
  }

  for (let lb of desktopBalls) {
    lb.show(fadeBallsAlpha);
  }

  // Arrow ball
  centerArrowBall.updateAngle(arrowEaseDuration);
  centerArrowBall.show();

  // Preview ball
  drawPreviewBallDesktop();

  // Update letter fade
  updateLetterFadeDesktop();

  // Draw phrase
  drawPhraseDesktop();
}

// DESKTOP: Mouse Pressed
function mousePressed() {
  if (MOBILE_MODE) {
    // If mobile, handle the circle link
    mousePressedMobile();
    return;
  }
  // DESKTOP
  if (isFadingBalls) return;
  if (!isInsideInteractiveArea(mouseX - ballSpawnOffset.x, mouseY - ballSpawnOffset.y)) return;
  
  if (phraseIndex < phrase.length) {
    let c = phrase[phraseIndex];
    let upperC = c.toUpperCase();
    createLetterBallDesktop(mouseX - ballSpawnOffset.x, mouseY - ballSpawnOffset.y, upperC);
    letterSpawnTimes[phraseIndex] = millis() / 1000;
    phraseIndex++;

    if (phraseIndex === phrase.length) {
      startFadingBallsDesktop();
    }
  }
}

function startFadingBallsDesktop() {
  isFadingBalls = true;
  fadeBallsStartTime = millis() / 1000;
}

// DESKTOP: Create a letter ball
function createLetterBallDesktop(x, y, letter) {
  let options = {
    friction: physicsConfigDesktop.friction,
    frictionAir: physicsConfigDesktop.airDrag,
    density: physicsConfigDesktop.density,
    restitution: physicsConfigDesktop.restitution
  };
  let body = Bodies.circle(x, y, 24 * scaleFactor, options);
  let lb = new LetterBall(body, letter, phraseIndex);
  desktopBalls.push(lb);
  World.add(desktopWorld, body);

  // random angle velocity
  ballInitialVelocityAngle = random(ballInitialVelocityAngleMIN, ballInitialVelocityAngleMAX);
  let velX = ballInitialVelocitySpeed * scaleFactor * cos(radians(ballInitialVelocityAngle));
  let velY = ballInitialVelocitySpeed * scaleFactor * sin(radians(ballInitialVelocityAngle));
  Matter.Body.setVelocity(body, { x: velX, y: velY });
  
  centerArrowBall.setTargetBall(lb);
}

// DESKTOP: Ghost ball updates
function updateGhostBallDesktop() {
  let newPos = { 
    x: mouseX - ghostBallOffset.x, 
    y: mouseY - ghostBallOffset.y 
  };
  Matter.Body.setPosition(previewBody, newPos);
  let vx = newPos.x - oldMousePos.x;
  let vy = newPos.y - oldMousePos.y;
  Matter.Body.setVelocity(previewBody, { x: vx, y: vy });
  oldMousePos.x = newPos.x;
  oldMousePos.y = newPos.y;
}

function updateGhostBallScaleDesktop() {
  let inside = isInsideInteractiveArea(mouseX - ghostBallOffset.x, mouseY - ghostBallOffset.y);
  if (inside) {
    ghostBallScale = lerp(ghostBallScale, 1, 0.15);
  } else {
    ghostBallScale = lerp(ghostBallScale, 0, 0.15);
  }
}

function drawPreviewBallDesktop() {
  let pos = previewBody.position;
  push();
  translate(pos.x, pos.y);
  rotate(previewBody.angle);
  scale(ghostBallScale);
  noStroke();
  fill(...ghostBallFill);
  ellipse(0, 0, 60 * scaleFactor);
  
  if (phraseIndex < phrase.length) {
    let nextLetter = phrase[phraseIndex].toUpperCase();
    fill(...ghostTextFill);
    textSize(25 * scaleFactor * 0.8);
    let w = textWidth(nextLetter);
    let a = textAscent();
    let d = textDescent();
    textAlign(LEFT, BASELINE);
    text(nextLetter, -w / 2, (a - d) / 2);
  }
  pop();
}

// DESKTOP: Layout & walls
function updateLayout() {
  scaleFactor = min(windowWidth / refW, windowHeight / refH);
  containerW = refW * scaleFactor;
  containerH = refH * scaleFactor;
  containerX = (windowWidth - containerW) / 2;
  containerY = (windowHeight - containerH) / 2;
  
  leftPanelX = containerX + marginLeftRightRef * scaleFactor;
  leftPanelY = containerY + marginTopBottomRef * scaleFactor;
  leftPanelW = leftPanelRefW * scaleFactor;
  leftPanelH = leftPanelRefH * scaleFactor;
  
  rightPanelX = leftPanelX + leftPanelW + gapRef * scaleFactor;
  rightPanelY = containerY + marginTopBottomRef * scaleFactor;
  rightPanelW = rightPanelRefW * scaleFactor;
  rightPanelH = rightPanelRefH * scaleFactor;
  
  phrasePadding = 20 * scaleFactor;
  phraseX = rightPanelX + phrasePadding;
  phraseY = rightPanelY + phrasePadding;
  
  leftPanelCenterX = leftPanelX + leftPanelW / 2;
  leftPanelCenterY = leftPanelY + leftPanelH / 2;
}

function createRectWalls(cx, cy, w, h) {
  let group = Composite.create();
  let thick = 100 * scaleFactor;
  
  let halfW = w / 2;
  let halfH = h / 2;
  
  let topWall    = Bodies.rectangle(cx, cy - halfH - thick / 2, w + 2 * thick, thick, { isStatic: true });
  let bottomWall = Bodies.rectangle(cx, cy + halfH + thick / 2, w + 2 * thick, thick, { isStatic: true });
  let leftWall   = Bodies.rectangle(cx - halfW - thick / 2, cy, thick, h + 2 * thick, { isStatic: true });
  let rightWall  = Bodies.rectangle(cx + halfW + thick / 2, cy, thick, h + 2 * thick, { isStatic: true });
  
  Composite.add(group, [topWall, bottomWall, leftWall, rightWall]);
  return group;
}

// DESKTOP: phrase & fade
function drawPhraseDesktop() {
  textSize(20 * scaleFactor);
  textAlign(LEFT, TOP);
  
  let lines = phrase.split("\n");
  let globalIndex = 0;
  
  let y = phraseY;
  for (let line of lines) {
    let x = phraseX;
    for (let i = 0; i < line.length; i++) {
      let c = line[i];
      let alphaVal = letterAlphas[globalIndex] || 51;
      fill(...phraseTextColor, alphaVal);
      text(c, x, y);
      let w = textWidth(c);
      x += w;
      globalIndex++;
    }
    // skip \n
    globalIndex++;
    y += 30 * scaleFactor;
  }
}

function updateLetterFadeDesktop() {
  let nowSec = millis() / 1000;
  for (let i = 0; i < phrase.length; i++) {
    let st = letterSpawnTimes[i];
    if (st !== null && st !== undefined) {
      let elapsed = nowSec - st;
      let t = constrain(elapsed / fadeInDuration, 0, 1);
      letterAlphas[i] = lerp(51, 255, t);
    }
  }
}

// Desktop: letter ball class
class LetterBall {
  constructor(body, letter, phraseIdx) {
    this.body = body;
    this.letter = letter;
    this.r = 24 * scaleFactor;
    this.phraseIdx = phraseIdx;
  }
  show(fadeAlpha=1) {
    let pos = this.body.position;
    let angle = this.body.angle;
    
    let isHighlight = highlightIndices.includes(this.phraseIdx);
    let ballFill = isHighlight ? highlightBallFill : defaultBallFill;
    let textFill = isHighlight ? highlightTextFill : defaultTextFill;
    
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    noStroke();
    fill(...ballFill, 255*fadeAlpha);
    ellipse(0, 0, this.r * 2);
    
    fill(...textFill, 255*fadeAlpha);
    textSize(this.r*0.8);
    let w = textWidth(this.letter);
    let a = textAscent();
    let d = textDescent();
    textAlign(LEFT, BASELINE);
    text(this.letter, -w / 2, (a - d) / 2);
    pop();
  }
}

// DESKTOP: center arrow
class CenterArrowBall {
  constructor(x, y, r) {
    this.r = r;
    this.body = Bodies.circle(x, y, r, { isStatic: true, restitution: 2 });
    this.currentAngle = 0;
    this.arrowState = "TRACKING_MOUSE"; 
    this.target = "mouse"; 
    this.easingStartTime = 0;
    this.easeFromAngle = 0;
  }
  
  setTargetBall(letterBall) {
    this.target = letterBall;
    this.startEasing();
  }
  setTargetToMouse() {
    this.target = "mouse";
    this.startEasing();
  }
  startEasing() {
    this.arrowState = "EASING";
    this.easingStartTime = millis() / 1000;
    this.easeFromAngle = this.currentAngle;
  }
  
  updateAngle(easeDur) {
    let pos = this.body.position;
    let nowSec = millis() / 1000;
    let liveAngle;
    if (this.target === "mouse") {
      liveAngle = atan2(mouseY - pos.y, mouseX - pos.x);
    } else {
      let bPos = this.target.body.position;
      liveAngle = atan2(bPos.y - pos.y, bPos.x - pos.x);
    }
    
    if (this.arrowState === "EASING") {
      let t = (nowSec - this.easingStartTime) / easeDur;
      if (t >= 1) {
        t = 1;
        this.arrowState = (this.target === "mouse") ? "TRACKING_MOUSE" : "TRACKING_BALL";
      }
      let eased = easeInOutQuad(t);
      this.currentAngle = lerpAngle(this.easeFromAngle, liveAngle, eased);
    } else {
      this.currentAngle = liveAngle;
    }
  }
  
  show() {
    let pos = this.body.position;
    push();
    translate(pos.x, pos.y);
    rotate(this.currentAngle);
    noStroke();
    fill(...arrowCircleColor);
    ellipse(0, 0, this.r * 2);
    
    fill(...arrowGlyphColor);
    let arrowGlyph = "→";
    textSize(this.r);
    let w = textWidth(arrowGlyph);
    let a = textAscent();
    let d = textDescent();
    textAlign(LEFT, BASELINE);
    text(arrowGlyph, -w / 2, (a - d) / 2);
    pop();
  }
}

// ===========================================================================
// MOBILE MODE
// ===========================================================================
// ----- MOBILE MODE SECTION (updates only) -----

// In setupMobile(), we still create the walls and the letter balls.
function setupMobile() {
  // Disable scrolling by using noCanvas() then recreating the canvas
  noCanvas();
  createCanvas(windowWidth, windowHeight);

  mobileEngine = Engine.create();
  mobileWorld = mobileEngine.world;

  // Set initial gravity to zero; it will be updated by device orientation.
  mobileEngine.world.gravity.x = 0;
  mobileEngine.world.gravity.y = 0;

  // Create walls around the screen so balls remain confined.
  deviceWalls = createMobileWalls();
  World.add(mobileWorld, deviceWalls);

  // Create a large static circle in the center (for collisions)
  let radius = min(width, height) * 0.35;
  mobileCircleBody = Bodies.circle(width / 2, height / 2, radius, { isStatic: true });
  World.add(mobileWorld, mobileCircleBody);

  // Create 3 sets of "NOAMSADI" (24 balls total)
  let letters = "NOAMSADI";
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < letters.length; i++) {
      createMobileLetterBall(letters[i]);
    }
  }

  // Listen for device orientation events.
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function") {
    // For iOS 13+ devices.
    DeviceOrientationEvent.requestPermission().then((response) => {
      if (response === "granted") {
        window.addEventListener("deviceorientation", handleDeviceOrientation, true);
      }
    }).catch(console.error);
  } else {
    window.addEventListener("deviceorientation", handleDeviceOrientation, true);
  }
}

// Update the device orientation handling so gravity reacts to tilt.
function handleDeviceOrientation(event) {
  // gamma: left-right tilt, beta: front-back tilt.
  // Normalize gamma (-90 to 90) and beta (typically -90 to 90) so that if fully tilted, gravity ≈ 1.
  let normGamma = constrain(event.gamma / 90, -1, 1);
  let normBeta  = constrain(event.beta  / 90, -1, 1);
  mobileEngine.world.gravity.x = normGamma;
  mobileEngine.world.gravity.y = normBeta;
}

// Increase restitution so balls bounce more.
function createMobileLetterBall(letter) {
  let r = 25; // ball radius
  let x = random(r, width - r);
  let y = random(r, height - r);
  let body = Bodies.circle(x, y, r, {
    restitution: 0.9,   // increased for bounciness
    frictionAir: 0.02
  });
  let mb = new MobileLetterBall(body, letter, r);
  mobileBalls.push(mb);
  World.add(mobileWorld, body);
}

// The rest of the mobile code remains as before:
function drawMobile() {
  background("#FFEB3B"); // Bright yellow background
  Engine.update(mobileEngine);

  // Draw the big circle in the center with text.
  fill(255);
  noStroke();
  let radius = min(width, height) * 0.35;
  ellipse(width / 2, height / 2, radius * 2);

  // Draw the text in the circle.
  fill(0);
  textSize(radius * 0.07);
  textAlign(CENTER, CENTER);
  text(mobileCircleText, width / 2, height / 2);

  // Draw each letter ball.
  for (let b of mobileBalls) {
    b.show();
  }
}

// Walls remain the same.
function createMobileWalls() {
  let group = Composite.create();
  let thick = 200; // wall thickness
  let topWall    = Bodies.rectangle(width / 2, -thick / 2, width + thick * 2, thick, { isStatic: true });
  let bottomWall = Bodies.rectangle(width / 2, height + thick / 2, width + thick * 2, thick, { isStatic: true });
  let leftWall   = Bodies.rectangle(-thick / 2, height / 2, thick, height + thick * 2, { isStatic: true });
  let rightWall  = Bodies.rectangle(width + thick / 2, height / 2, thick, height + thick * 2, { isStatic: true });
  Composite.add(group, [topWall, bottomWall, leftWall, rightWall]);
  return group;
}

class MobileLetterBall {
  constructor(body, letter, r) {
    this.body = body;
    this.letter = letter;
    this.r = r;
  }
  show() {
    let pos = this.body.position;
    let angle = this.body.angle;
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    fill(170);
    noStroke();
    ellipse(0, 0, this.r * 2);
    fill(0);
    textSize(this.r);
    textAlign(CENTER, CENTER);
    text(this.letter, 0, 0);
    pop();
  }
}
