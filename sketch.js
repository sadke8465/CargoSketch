// sketch.js

// --------------------------------------------------------------------------
// HELPER FUNCTIONS & GLOBAL DETECTION
// --------------------------------------------------------------------------

// 1) Detect if mobile device (simple check)
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone|Opera Mini|Mobile/i.test(navigator.userAgent);
}

// 2) Easing functions
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
let MOBILE_MODE = false; // set true if on mobile

// Matter.js engines/worlds
let desktopEngine, desktopWorld;
let mobileEngine, mobileWorld;

// --------------------------------------------------------------------------
// DESKTOP MODE GLOBALS
// --------------------------------------------------------------------------
let wallComposite;
let centerArrowBall;
let previewBody;
let oldMousePos = { x: 0, y: 0 };
let ghostBallScale = 0; // starts invisible

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
let scaleFactor, containerW, containerH, containerX, containerY;
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

// Desktop colors and physics configuration
let backgroundColor = [230];
let phraseTextColor = [0];
let highlightBallFill = [70, 200, 70];
let highlightTextFill = [255];
let defaultBallFill = [170];
let defaultTextFill = [0];
let arrowCircleColor = [80];
let arrowGlyphColor = [255];
let ghostBallFill = [127, 50];
let ghostTextFill = [0, 50];
let interactiveOutlineColor = [170];
let physicsConfigDesktop = {
  gravity: 0.8,
  friction: 0.01,
  airDrag: 0.0,
  density: 0.01,
  restitution: 0.8
};
let arrowEaseDuration = 0.5;

// --------------------------------------------------------------------------
// MOBILE MODE GLOBALS & STYLING VARIABLES
// --------------------------------------------------------------------------

// Styling for letter balls:
let letterBallSize = 18;            // radius
let letterBallTextSize = 14;        // text size
let letterBallColor = [170];        // fill color
let letterBallTextColor = [0];      // text color

// Styling for final text circle:
let textBallSize = 110;             // radius (and used for physics body size)
let textBallColor = [255];          // fill color
let textBallTextSize = 14;          // text size
let textBallTextColor = [0];        // text color

// Styling for "Enable Motion" circle:
let enableMotionBallColor = [255];  // fill color
let enableMotionTextColor = [0];    // text color
let enableMotionText = "Enable Motion";

// Background colors:
let enableMotionBackgroundColor = [80];
let regularBackgroundColor = [255, 235, 59];

// Final text for final text circle:
let finalTextBallText = "This site is best viewed on a desktop device\n\n☺\n\nClick here to contact!";

// Mobile state machine states:
// "ENABLE_MOTION": Show the enable motion button.
// "SHOW_TEXT_BALL": Final state; show final text circle and letter balls.
let mobileState = "ENABLE_MOTION";
// (Fade state removed as transition is now immediate)
let enableMotionAlpha = 255;
let finalTextAlpha = 255; // always full opacity now
let bgColorFrom = [...enableMotionBackgroundColor];
let bgColorTo = [...regularBackgroundColor];

// Mobile letter balls (spawn after transition)
let mobileBalls = [];

// We'll use an HTML button to request motion permission on iOS.
let permissionButton;

// For gradual spawning of letter balls
let mobileLettersToSpawn = [];

// New global to track the rotation of the big center circle
let mobileBigCircleAngle = 0;

// --------------------------------------------------------------------------
// p5.js SETUP & DRAW
// --------------------------------------------------------------------------
function preload() {
  myFont = loadFont("Geist UltraLight.otf");
}

function setup() {
  textFont(myFont);
  MOBILE_MODE = isMobileDevice();
  console.log("User agent:", navigator.userAgent);
  console.log("Detected mobile?", MOBILE_MODE);
  
  if (MOBILE_MODE) {
    setupMobile();
  } else {
    createCanvas(windowWidth, windowHeight);
    setupDesktop();
  }
}

function draw() {
  if (MOBILE_MODE) {
    drawMobile();
  } else {
    background(...backgroundColor);
    drawDesktop();
  }
}

// ===========================================================================
// DESKTOP MODE FUNCTIONS
// ===========================================================================
function setupDesktop() {
  desktopEngine = Engine.create();
  desktopWorld = desktopEngine.world;
  desktopEngine.world.gravity.y = physicsConfigDesktop.gravity;
  for (let i = 0; i < phrase.length; i++) {
    letterAlphas[i] = 51;
    letterSpawnTimes[i] = null;
  }
  highlightIndices = findExactSubstringIndices(phrase, substringToHighlight);
  updateLayout();
  wallComposite = createRectWalls(leftPanelCenterX, leftPanelCenterY, leftPanelW, leftPanelH);
  World.add(desktopWorld, wallComposite);
  centerArrowBall = new CenterArrowBall(leftPanelCenterX, leftPanelCenterY, 40 * scaleFactor);
  World.add(desktopWorld, centerArrowBall.body);
  previewBody = Bodies.circle(
    mouseX - ghostBallOffset.x,
    mouseY - ghostBallOffset.y,
    35 * scaleFactor, { restitution: 1.5, frictionAir: 0, inertia: Infinity }
  );
  World.add(desktopWorld, previewBody);
  oldMousePos.x = mouseX - ghostBallOffset.x;
  oldMousePos.y = mouseY - ghostBallOffset.y;
}

function drawDesktop() {
  noStroke();
  fill(255, 255, 0);
  rect(leftPanelX, leftPanelY, leftPanelW, leftPanelH);
  fill(255);
  rect(rightPanelX, rightPanelY, rightPanelW, rightPanelH);
  Engine.update(desktopEngine);
  updateGhostBallDesktop();
  updateGhostBallScaleDesktop();
  let fadeBallsAlpha = 1;
  if (isFadingBalls) {
    let nowSec = millis() / 1000;
    let t = (nowSec - fadeBallsStartTime) / fadeBallsDuration;
    if (t >= 1) {
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
  centerArrowBall.updateAngle(arrowEaseDuration);
  centerArrowBall.show();
  drawPreviewBallDesktop();
  updateLetterFadeDesktop();
  drawPhraseDesktop();
}

function mousePressed() {
  if (MOBILE_MODE) {
    mousePressedMobile();
    return;
  }
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
  ballInitialVelocityAngle = random(ballInitialVelocityAngleMIN, ballInitialVelocityAngleMAX);
  let velX = ballInitialVelocitySpeed * scaleFactor * cos(radians(ballInitialVelocityAngle));
  let velY = ballInitialVelocitySpeed * scaleFactor * sin(radians(ballInitialVelocityAngle));
  Matter.Body.setVelocity(body, { x: velX, y: velY });
  centerArrowBall.setTargetBall(lb);
}

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
  let topWall = Bodies.rectangle(cx, cy - halfH - thick / 2, w + 2 * thick, thick, { isStatic: true });
  let bottomWall = Bodies.rectangle(cx, cy + halfH + thick / 2, w + 2 * thick, thick, { isStatic: true });
  let leftWall = Bodies.rectangle(cx - halfW - thick / 2, cy, thick, h + 2 * thick, { isStatic: true });
  let rightWall = Bodies.rectangle(cx + halfW + thick / 2, cy, thick, h + 2 * thick, { isStatic: true });
  Composite.add(group, [topWall, bottomWall, leftWall, rightWall]);
  return group;
}

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

class LetterBall {
  constructor(body, letter, phraseIdx) {
    this.body = body;
    this.letter = letter;
    this.r = 24 * scaleFactor;
    this.phraseIdx = phraseIdx;
  }
  show(fadeAlpha = 1) {
    let pos = this.body.position;
    let angle = this.body.angle;
    let isHighlight = highlightIndices.includes(this.phraseIdx);
    let ballFill = isHighlight ? highlightBallFill : defaultBallFill;
    let textFill = isHighlight ? highlightTextFill : defaultTextFill;
    push();
    translate(pos.x, pos.y);
    rotate(angle);
    noStroke();
    fill(...ballFill, 255 * fadeAlpha);
    ellipse(0, 0, this.r * 2);
    fill(...textFill, 255 * fadeAlpha);
    textSize(this.r * 0.8);
    let w = textWidth(this.letter);
    let a = textAscent();
    let d = textDescent();
    textAlign(LEFT, BASELINE);
    text(this.letter, -w / 2, (a - d) / 2);
    pop();
  }
}

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
// MOBILE MODE FUNCTIONS (with DeviceMotion, Permission, and your changes)
// ===========================================================================
function setupMobile() {
  // Create the canvas for mobile.
  createCanvas(windowWidth, windowHeight);
  mobileEngine = Engine.create();
  mobileWorld = mobileEngine.world;
  mobileEngine.world.gravity.x = 0;
  mobileEngine.world.gravity.y = 0;
  
  // Create walls: top, bottom, left, right.
  let group = Composite.create();
  let thick = 200;
  let topWall = Bodies.rectangle(width / 2, -thick / 2, width + thick * 2, thick, { isStatic: true });
  let bottomWall = Bodies.rectangle(width / 2, height + thick / 2, width + thick * 2, thick, { isStatic: true });
  let leftWall = Bodies.rectangle(-thick / 2, height / 2, thick, height + thick * 2, { isStatic: true });
  let rightWall = Bodies.rectangle(width + thick / 2, height / 2, thick, height + thick * 2, { isStatic: true });
  Composite.add(group, [topWall, bottomWall, leftWall, rightWall]);
  World.add(mobileWorld, group);
  
  // Create a static center circle for collision (using textBallSize as the radius).
  mobileCircleBody = Bodies.circle(width / 2, height / 2, textBallSize, { isStatic: true });
  World.add(mobileWorld, mobileCircleBody);
  
  // Set initial mobile state.
  mobileState = "ENABLE_MOTION";
  enableMotionAlpha = 255;
  finalTextAlpha = 255;
  bgColorFrom = [...enableMotionBackgroundColor];
  bgColorTo = [...regularBackgroundColor];
  console.log("Mobile setup complete. State:", mobileState);
  
  // Request permission for device orientation and motion (for iOS 13+)
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function") {
    permissionButton = createButton(enableMotionText);
    permissionButton.style('width', (textBallSize * 2) + 'px');
    permissionButton.style('height', (textBallSize * 2) + 'px');
    permissionButton.style('background-color', color(enableMotionBallColor));
    permissionButton.style('color', color(enableMotionTextColor));
    // Set the font to Geist UltraLight.
    permissionButton.style("font-family", "Geist UltraLight");
    permissionButton.style('border', 'none');
    permissionButton.style('border-radius', '50%');
    permissionButton.style('font-size', textBallTextSize + 'px');
    permissionButton.position(width / 2 - textBallSize, height / 2 - textBallSize);
    permissionButton.mousePressed(requestMotionPermission);
  } else {
    window.addEventListener("deviceorientation", handleDeviceOrientation, true);
    window.addEventListener("devicemotion", handleDeviceMotion, true);
  }
}

function drawMobile() {
  Engine.update(mobileEngine);
  
  if (mobileState === "ENABLE_MOTION") {
    background(...enableMotionBackgroundColor);
    // The permission button remains visible.
  } else if (mobileState === "SHOW_TEXT_BALL") {
    background(...regularBackgroundColor);
    drawFinalTextCircle(255);
    for (let b of mobileBalls) {
      b.show();
    }
  }
}

function mousePressedMobile() {
  if (mobileState === "ENABLE_MOTION") {
    // The HTML button handles permission.
    return;
  }
  if (mobileState === "SHOW_TEXT_BALL") {
    let d = dist(mouseX, mouseY, width / 2, height / 2);
    if (d <= textBallSize) {
      window.location.href = "mailto:sadke8465@gmail.com";
    }
  }
}

function touchStarted() {
  if (MOBILE_MODE) {
    mousePressedMobile();
  }
}

function requestMotionPermission() {
  console.log("Requesting motion permission...");
  if (typeof DeviceOrientationEvent !== "undefined" &&
      typeof DeviceOrientationEvent.requestPermission === "function") {
    DeviceOrientationEvent.requestPermission()
      .then(response => {
        if (response === "granted") {
          window.addEventListener("deviceorientation", handleDeviceOrientation, true);
          if (typeof DeviceMotionEvent !== "undefined" &&
              typeof DeviceMotionEvent.requestPermission === "function") {
            DeviceMotionEvent.requestPermission()
              .then(motionResponse => {
                if (motionResponse === "granted") {
                  window.addEventListener("devicemotion", handleDeviceMotion, true);
                } else {
                  console.log("Device motion permission denied.");
                }
              })
              .catch(console.error);
          } else {
            window.addEventListener("devicemotion", handleDeviceMotion, true);
          }
          if (permissionButton) {
            permissionButton.hide();
          }
          startTransition();  // Instant transition without fade.
        } else {
          console.log("Device orientation permission denied.");
        }
      })
      .catch(err => console.error("Error requesting device orientation permission:", err));
  } else {
    window.addEventListener("deviceorientation", handleDeviceOrientation, true);
    window.addEventListener("devicemotion", handleDeviceMotion, true);
    startTransition();
  }
}

// Instant transition without fade.
function startTransition() {
  mobileState = "SHOW_TEXT_BALL";
  spawnAllMobileBalls();
  console.log("Transition to SHOW_TEXT_BALL");
}

function drawEnableMotionCircle(alphaVal) {
  push();
  translate(width / 2, height / 2);
  rotate(mobileBigCircleAngle);
  fill(...enableMotionBallColor, alphaVal);
  noStroke();
  ellipse(0, 0, textBallSize * 2);
  fill(...enableMotionTextColor, alphaVal);
  textAlign(CENTER, CENTER);
  textSize(textBallTextSize);
  text(enableMotionText, 0, 0);
  pop();
}

function drawFinalTextCircle(alphaVal) {
  push();
  translate(width / 2, height / 2);
  rotate(mobileBigCircleAngle);
  fill(...textBallColor, alphaVal);
  noStroke();
  ellipse(0, 0, textBallSize * 2);
  fill(...textBallTextColor, alphaVal);
  textAlign(CENTER, CENTER);
  textSize(textBallTextSize);
  text(finalTextBallText, 0, 0);
  pop();
}

// Handle device orientation: update gravity (stronger) and update the big circle's rotation.
function handleDeviceOrientation(event) {
  if (!event.beta || !event.gamma || !event.alpha) return;
  let gamma = event.gamma;
  let beta = event.beta;
  // Map gravity more strongly.
  mobileEngine.world.gravity.x = map(gamma, -90, 90, -1, 1);
  mobileEngine.world.gravity.y = map(beta, -90, 90, -1, 1);
  // Update the rotation angle using the device's alpha value.
  mobileBigCircleAngle = radians(event.alpha);
}

// Handle device motion: apply extra forces on mobile balls when a shake/whip is detected.
function handleDeviceMotion(event) {
  let acc = event.acceleration; // acceleration excluding gravity
  if (!acc) return;
  let magnitude = sqrt(
    (acc.x || 0) * (acc.x || 0) +
    (acc.y || 0) * (acc.y || 0) +
    (acc.z || 0) * (acc.z || 0)
  );
  const threshold = 5; // adjust threshold as needed
  if (magnitude > threshold) {
    let forceScale = 0.0005; // adjust force magnitude
    for (let mb of mobileBalls) {
      Matter.Body.applyForce(
        mb.body,
        mb.body.position,
        {
          x: (acc.x || 0) * forceScale,
          y: (acc.y || 0) * forceScale
        }
      );
    }
  }
}

function spawnAllMobileBalls() {
  mobileLettersToSpawn = [];
  let letters = "NOAMSADI";
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < letters.length; i++) {
      mobileLettersToSpawn.push(letters[i]);
    }
  }
  spawnNextMobileBall();
}

function spawnNextMobileBall() {
  if (mobileLettersToSpawn.length === 0) return;
  let letter = mobileLettersToSpawn.shift();
  createMobileLetterBall(letter, false);
  setTimeout(spawnNextMobileBall, 50);
}

function createMobileLetterBall(letter, spawnAbove = false) {
  let r = letterBallSize;
  let x = random(r, width - r);
  let y = spawnAbove ? -r * 2 : random(r, height - r);
  let body = Bodies.circle(x, y, r, {
    restitution: 0.95,
    frictionAir: 0.00001
  });
  let mb = new MobileLetterBall(body, letter, r);
  mobileBalls.push(mb);
  World.add(mobileWorld, body);
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
    fill(...letterBallColor);
    noStroke();
    ellipse(0, 0, this.r * 2);
    fill(...letterBallTextColor);
    textAlign(CENTER, CENTER);
    textSize(letterBallTextSize);
    // Move text upward a few pixels.
    text(this.letter, 0, -this.r * 0.2);
    pop();
  }
}

// For desktop mode, the mousePressed function remains unchanged.
function mousePressed() {
  if (MOBILE_MODE) {
    mousePressedMobile();
    return;
  }
  // Desktop mode (unchanged).
}
