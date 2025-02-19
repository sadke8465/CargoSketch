// sketch.js
//
// Enhancements:
// 1) Fade out all balls at the end of the phrase over a configurable duration.
// 2) Arrow circle + arrow glyph have separate color variables.
// 3) All colors are variables at top for easy editing.
// 4) Top phrase is placed in the right panel (white) instead of centered.
// 5) Ghost ball shrinks out (invisibility) when the mouse is not inside the interactive area.
// 6) Ghost ball now follows the mouse continuously while growing/shrinking.
// 7) Letter balls are now generated with an offset relative to the mouse pointer.
// 8) Two new offset variables control the ghost ball's visual offset and the ball generation offset.
// 9) **New:** Letter balls are given an initial velocity (speed and angle) upon creation.
//
// Layout Changes:
//  - Full screen canvas divided into two panels:
//    * Left panel (yellow, interactive): Reference size 500×770
//    * Right panel (white): Reference size 770×770
//    * Gap: 32 px, margins: 174 px (top/bottom) & 213 px (left/right)
//    * Layout scales proportionally with screen size
//
// Ball/Letter System Changes:
//  - The left (yellow) panel now serves as the interactive area (instead of a rotating square).
//  - The center arrow ball is positioned in the center of the left panel.
//  - All physics interactions (letter balls, ghost ball) are confined to the left panel.
//
// Author: Your Name
// ---------------------------------------------------------------------------

// --------------------------
// MATTER.JS ALIASES
// --------------------------
const Engine = Matter.Engine;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Composite = Matter.Composite;

// --------------------------
// PHRASE & HIGHLIGHT
// --------------------------
let phrase = 
`Hey, I’m Noam Sadi, a 
multidisciplinary designer.

Looking for a place to grow.`;

let substringToHighlight = "NoamSadi"; 
let highlightIndices = [];

// Each character of the phrase fades from alpha=51 -> 255 upon spawn
let letterAlphas = [];
let letterSpawnTimes = [];
let fadeInDuration = 0.15; // seconds from 20% to 100%

// Next char index to spawn
let phraseIndex = 0;

// --------------------------
// LAYOUT CONFIGURATION (Responsive)
// Reference dimensions for layout (at 1728×1117)
const refW = 1728;
const refH = 1117;
const leftPanelRefW = 500;
const leftPanelRefH = 770;
const rightPanelRefW = 770;
const rightPanelRefH = 770;
const gapRef = 32;
const marginLeftRightRef = 213;
const marginTopBottomRef = 174;

// Layout variables (computed based on window size)
let scaleFactor;
let containerW, containerH, containerX, containerY;
let leftPanelX, leftPanelY, leftPanelW, leftPanelH;
let rightPanelX, rightPanelY, rightPanelW, rightPanelH;
let phraseX, phraseY, phrasePadding;
let leftPanelCenterX, leftPanelCenterY;

// --------------------------
// OFFSET VARIABLES
// --------------------------
// Controls the visual offset of the ghost ball relative to the mouse pointer
let ghostBallOffset = { x: 10, y: 10 };
// Controls the spawn position offset for letter balls relative to the mouse pointer
let ballSpawnOffset = { x: 7, y: 7 };

// --------------------------
// INITIAL VELOCITY VARIABLES FOR LETTER BALLS
// --------------------------
let ballInitialVelocitySpeed = 7;   // Adjust speed as desired
let ballInitialVelocityAngle
let ballInitialVelocityAngleMAX = -70
let ballInitialVelocityAngleMIN = -120

;  // In degrees (-90 gives an upward initial velocity)

// --------------------------
// PHYSICS (MATTER.JS)
// --------------------------
let engine, world;
let wallComposite;

// --------------------------
// BALLS
// --------------------------
let letterBalls = [];

// Fade-out for balls (after the full phrase is spawned)
let isFadingBalls = false;
let fadeBallsStartTime = 1.5;
let fadeBallsDuration = 0.1; // seconds to fade out the balls

// --------------------------
// COLORS (ALL VARIABLES)
// --------------------------

// 1) Background
let backgroundColor = [230]; // Light gray

// 2) Phrase text color (before spawn, partially transparent)
let phraseTextColor = [0]; // black

// 3) Highlight ball fill / text fill
let highlightBallFill = [70,200,70];   // dark gray
let highlightTextFill = [255];  // white

// 4) Default ball fill / text fill
let defaultBallFill = [170]; // lighter gray
let defaultTextFill = [0];   // black

// 5) Arrow circle color
let arrowCircleColor = [80];  // a greenish color
// 6) Arrow glyph color
let arrowGlyphColor  = [255];    // a reddish color

// 7) Ghost ball color
let ghostBallFill    = [127, 50];        // ~20% alpha
let ghostTextFill    = [0, 50];          // ~20% alpha for text

// 8) (Optional) Outline color for the interactive area
let interactiveOutlineColor = [170]; // black

// --------------------------
// GHOST BALL
// --------------------------
let previewBody;
let oldMousePos = { x: 0, y: 0 };
// Scale factor for ghost ball (shrinks to 0 when mouse is outside)
let ghostBallScale = 0; // starts invisible

// --------------------------
// PHYSICS CONFIG
// --------------------------
let physicsConfig = {
  gravity: 0.8,
  friction: 0.01,
  airDrag: 0.0,
  density: 0.01,
  restitution: 0.8
};

// Arrow easing duration
let arrowEaseDuration = 0.5;

// FONT
let myFont;
function preload() {
  myFont = loadFont("Geist UltraLight.otf");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  ballInitialVelocityAngle = random(ballInitialVelocityAngleMIN, ballInitialVelocityAngleMAX); // Assign a random value in setup()

  updateLayout(); // compute layout variables based on current window size
  
  engine = Engine.create();
  world = engine.world;
  engine.world.gravity.y = physicsConfig.gravity;
  
  textFont(myFont);
  
  // 1) Initialize letter fade values
  for (let i = 0; i < phrase.length; i++) {
    letterAlphas[i] = 51;
    letterSpawnTimes[i] = null;
  }
  
  // 2) Determine indices for the substring "NoamSadi"
  highlightIndices = findExactSubstringIndices(phrase, substringToHighlight);
  
  // 3) Create static walls for the interactive (left) panel
  wallComposite = createRectWalls(leftPanelCenterX, leftPanelCenterY, leftPanelW, leftPanelH);
  World.add(world, wallComposite);
  
  // 4) Create the center arrow ball (placed at the center of the left panel)
  centerArrowBall = new CenterArrowBall(leftPanelCenterX, leftPanelCenterY, 40 * scaleFactor);
  World.add(world, centerArrowBall.body);
  
  // 5) Create the ghost ball (for previewing the next letter)
  previewBody = Bodies.circle(
    mouseX - ghostBallOffset.x, 
    mouseY - ghostBallOffset.y, 
    35 * scaleFactor, {
      restitution: 1.5,
      frictionAir: 0,
      inertia: Infinity
    }
  );
  World.add(world, previewBody);
  
  // Initialize oldMousePos with the offset applied
  oldMousePos.x = mouseX - ghostBallOffset.x;
  oldMousePos.y = mouseY - ghostBallOffset.y;
}

function draw() {
  background(...backgroundColor);
  
  // Draw the two panels:
  noStroke();
  // Left panel (interactive area): yellow
  fill(255, 255, 0);
  rect(leftPanelX, leftPanelY, leftPanelW, leftPanelH);
  
  // Right panel (phrase area): white
  fill(255);
  rect(rightPanelX, rightPanelY, rightPanelW, rightPanelH);
  
  // Update physics engine
  Engine.update(engine);
  
  // Update ghost ball position so that it follows the mouse (using ghostBallOffset)
  updateGhostBall();
  
  // Update ghost ball scale based on whether the mouse is inside the interactive area
  updateGhostBallScale();
  
  // Draw letter balls (apply fade-out if needed)
  let fadeBallsAlpha = 1; 
  if (isFadingBalls) {
    let nowSec = millis() / 1000;
    let t = (nowSec - fadeBallsStartTime) / fadeBallsDuration;
    if (t >= 1) {
      // Remove balls after fade-out
      for (let lb of letterBalls) {
        World.remove(world, lb.body);
      }
      letterBalls = [];
      phraseIndex = 0;
      for (let i = 0; i < phrase.length; i++){
        letterAlphas[i] = 51;
        letterSpawnTimes[i] = null;
      }
      isFadingBalls = false;
      centerArrowBall.setTargetToMouse();
    } else {
      fadeBallsAlpha = 1 - t; 
    }
  }
  
  for (let lb of letterBalls) {
    lb.show(fadeBallsAlpha);
  }
  
  // Update and draw the center arrow ball
  centerArrowBall.updateAngle(arrowEaseDuration);
  centerArrowBall.show();
  
  // Draw ghost ball (preview ball)
  drawPreviewBall();
  
  // Update letter fade-in for the phrase
  updateLetterFade();
  
  // Draw the phrase in the right panel
  drawPhrase();
  
  // (Optional) Draw an outline around the interactive area
  // noFill();
  // stroke(...interactiveOutlineColor);
  // strokeWeight(2);
  // rect(leftPanelX, leftPanelY, leftPanelW, leftPanelH);
}

// ------------------------------------------------------------
// Window Resizing: recalc layout and update physics boundaries
// ------------------------------------------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();
  // Recreate the interactive area walls
  World.remove(world, wallComposite);
  wallComposite = createRectWalls(leftPanelCenterX, leftPanelCenterY, leftPanelW, leftPanelH);
  World.add(world, wallComposite);
  // Reposition the center arrow ball
  Matter.Body.setPosition(centerArrowBall.body, { x: leftPanelCenterX, y: leftPanelCenterY });
}

// ------------------------------------------------------------
// Update layout variables based on current window dimensions
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Create Rectangular Walls for the Interactive Area
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Create a Letter Ball at (x,y)
// ------------------------------------------------------------
function createLetterBall(x, y, letter) {
  let options = {
    friction: physicsConfig.friction,
    frictionAir: physicsConfig.airDrag,
    density: physicsConfig.density,
    restitution: physicsConfig.restitution
  };
  let body = Bodies.circle(x, y, 24 * scaleFactor, options);
  let lb = new LetterBall(body, letter, phraseIndex);
  letterBalls.push(lb);
  World.add(world, body);
  
  // Set initial velocity using the defined speed and angle.
  // Multiply speed by scaleFactor to keep it relative to the canvas size.
  let velX = ballInitialVelocitySpeed * scaleFactor * cos(radians(ballInitialVelocityAngle));
  let velY = ballInitialVelocitySpeed * scaleFactor * sin(radians(ballInitialVelocityAngle));
  Matter.Body.setVelocity(body, { x: velX, y: velY });
  
  centerArrowBall.setTargetBall(lb);
}

// ------------------------------------------------------------
// LetterBall Class
// ------------------------------------------------------------
class LetterBall {
  constructor(body, letter, phraseIdx) {
    this.body = body;
    this.letter = letter;  // uppercase
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
    textSize(this.r*0.8);
    let w = textWidth(this.letter);
    let a = textAscent();
    let d = textDescent();
    textAlign(LEFT, BASELINE);
    text(this.letter, -w / 2, (a - d) / 2);
    pop();
  }
}

// ------------------------------------------------------------
// CenterArrowBall Class
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Draw the phrase in the right panel
// ------------------------------------------------------------
function drawPhrase() {
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
    // Account for newline (skip the "\n")
    globalIndex++;
    y += 30 * scaleFactor; // line height (scaled)
  }
}

// ------------------------------------------------------------
// Fade in letters for the phrase
// ------------------------------------------------------------
function updateLetterFade() {
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

// ------------------------------------------------------------
// Ghost ball: Update scale and position so it follows the mouse (using ghostBallOffset)
// ------------------------------------------------------------
function updateGhostBallScale() {
  let inside = isInsideInteractiveArea(mouseX - ghostBallOffset.x, mouseY - ghostBallOffset.y);
  if (inside) {
    ghostBallScale = lerp(ghostBallScale, 1, 0.15);
  } else {
    ghostBallScale = lerp(ghostBallScale, 0, 0.15);
  }
}

function updateGhostBall() {
  // Always update the ghost ball's position to follow the mouse (with ghostBallOffset)
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

function drawPreviewBall() {
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
    textSize(25 * scaleFactor*0.8);
    let w = textWidth(nextLetter);
    let a = textAscent();
    let d = textDescent();
    textAlign(LEFT, BASELINE);
    text(nextLetter, -w / 2, (a - d) / 2);
  }
  pop();
}

// ------------------------------------------------------------
// EXACT SUBSTRING-FINDING for "NoamSadi" (ignoring spaces)
// ------------------------------------------------------------
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

// ------------------------------------------------------------
// Check if a point (mx, my) is inside the interactive (left) panel
// ------------------------------------------------------------
function isInsideInteractiveArea(mx, my) {
  return (mx >= leftPanelX && mx <= leftPanelX + leftPanelW &&
          my >= leftPanelY && my <= leftPanelY + leftPanelH);
}

// ------------------------------------------------------------
// Mouse interaction: spawn a letter ball if inside the interactive area
// ------------------------------------------------------------
function mousePressed() {
  ballInitialVelocityAngle = random(ballInitialVelocityAngleMIN, ballInitialVelocityAngleMAX); // Assign a random value in setup()
  if (isFadingBalls) return;
  if (!isInsideInteractiveArea(mouseX - ballSpawnOffset.x, mouseY - ballSpawnOffset.y)) return;
  
  if (phraseIndex < phrase.length) {
    let c = phrase[phraseIndex];
    let upperC = c.toUpperCase();
    // Spawn ball using the ballSpawnOffset
    createLetterBall(mouseX - ballSpawnOffset.x, mouseY - ballSpawnOffset.y, upperC);
    letterSpawnTimes[phraseIndex] = millis() / 1000;
    phraseIndex++;
    
    if (phraseIndex === phrase.length) {
      startFadingBalls();
    }
  }
}

// Start fading out all balls when the full phrase is reached
function startFadingBalls() {
  isFadingBalls = true;
  fadeBallsStartTime = millis() / 1000;
}

// ------------------------------------------------------------
// EASING functions
// ------------------------------------------------------------
function easeInOutQuad(t) {
  if (t < 0.5) return 2 * t * t;
  return -1 + (4 - 2 * t) * t;
}
function lerpAngle(a0, a1, amt) {
  return a0 + (a1 - a0) * amt;
}
