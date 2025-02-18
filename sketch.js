// sketch.js
//
// Enhancements:
// 1) Fade out all balls at the end of the phrase over a configurable duration.
// 2) Arrow circle + arrow glyph have separate color variables.
// 3) All colors are variables at top for easy editing.
// 4) Top phrase is placed to the left (instead of centered).
// 5) Ghost ball shrinks out (invisibility) when the mouse is not inside the rotating square.
//
// The rest of the logic is the same as before: 
//   - A top phrase that fades each character from 20% to 100% alpha once spawned.
//   - Only the substring "Noam Sadi" is highlighted for ball color.  
//   - Damped rotation of the square, arrow circle that eases to new balls, 
//     ghost ball that shows the next letter in uppercase.
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
// CANVAS & LAYOUT
// --------------------------
let canvasW = 1300;
let canvasH = 900;

// We'll place the phrase near the left side
let phraseX = canvasW*0.7;
let phraseY = canvasH*0.45;
let lineHeight = 30;

// --------------------------
// ROTATING SQUARE
// --------------------------
let sideLength = 500;
let halfSide;
let targetAngle = 0;
let currentAngle = 0;
let lastAngle = 0;
let rotationDamping = 0.08;

// --------------------------
// PHYSICS (MATTER.JS)
// --------------------------
let engine, world;
let wallComposite;

// --------------------------
// BALLS
// --------------------------
let letterBalls = [];

// "Noam Sadi" highlight means only those specific chars (in exact order) get special color
// We store the index in phrase => if in highlightIndices => highlight color
//
// We'll fade out the balls at the end of the phrase:
let isFadingBalls = false;
let fadeBallsStartTime = 1;
let fadeBallsDuration = 0.2; // seconds to fade out the balls

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

// 8) Outline color for the rotating square
let squareOutlineColor = [170]; // black

// --------------------------
// GHOST BALL
// --------------------------
let previewBody;
let oldMousePos = { x: 0, y: 0 };
// We'll keep a scale factor that goes to 0 if mouse is outside the square
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

// Arrow easing
let arrowEaseDuration = 0.5;

// FONT
let myFont;
function preload() {
  myFont = loadFont("Geist UltraLight.otf");
}

function setup() {
  createCanvas(canvasW, canvasH);

  engine = Engine.create();
  world = engine.world;
  engine.world.gravity.y = physicsConfig.gravity;

  textFont(myFont);

  // 1) Init letter alpha & spawn times
  for (let i = 0; i < phrase.length; i++) {
    letterAlphas[i] = 51;
    letterSpawnTimes[i] = null;
  }

  // 2) Find exact indices for substring "NoamSadi"
  highlightIndices = findExactSubstringIndices(phrase, substringToHighlight);

  // 3) Create rotating square
  halfSide = sideLength / 2;
  let squareX = width * 0.35;
  let squareY = height * 0.5;
  wallComposite = createSquareWalls(squareX, squareY, sideLength);
  World.add(world, wallComposite);

  // 4) Center arrow ball
  centerArrowBall = new CenterArrowBall(squareX, squareY, 40);
  World.add(world, centerArrowBall.body);

  // 5) Ghost ball
  previewBody = Bodies.circle(mouseX, mouseY, 35, {
    restitution: 1.5,
    frictionAir: 0,
    inertia: Infinity
  });
  World.add(world, previewBody);

  oldMousePos.x = mouseX;
  oldMousePos.y = mouseY;
}

function draw() {
  background(...backgroundColor);

  // Draw the phrase on the left
  drawLeftPhrase();
  fill(0);
 // text("FPS: " + round(frameRate()), 10, height - 20);


  // If we are NOT fading balls, we do normal rotation & spawning.
  // If isFadingBalls==true, we no longer spawn new balls; we just fade them out.
  
  // 1) Update rotation
  targetAngle = map(mouseX, 0, width, -180, 180);
  currentAngle = lerpAngle(currentAngle, targetAngle, rotationDamping);

  // 2) Rotate square
  let deltaDeg = currentAngle - lastAngle;
  if (abs(deltaDeg) > 0.0001) {
    Composite.rotate(wallComposite, radians(deltaDeg), {
      x: centerArrowBall.body.position.x,
      y: centerArrowBall.body.position.y
    });
  }
  lastAngle = currentAngle;

  // 3) Update ghost ball's position
  let vx = mouseX - oldMousePos.x;
  let vy = mouseY - oldMousePos.y;
  Matter.Body.setVelocity(previewBody, { x: vx, y: vy });
  Matter.Body.setPosition(previewBody, { x: mouseX - 15, y: mouseY - 15});
  oldMousePos.x = mouseX;
  oldMousePos.y = mouseY;

  // 4) Update physics
  Engine.update(engine);

  // 5) Draw rotating square
  push();
  translate(centerArrowBall.body.position.x, centerArrowBall.body.position.y);
  rotate(radians(currentAngle));
  rectMode(CENTER);
  noFill();
  stroke(...squareOutlineColor);
  strokeWeight(2);
  rect(0, 0, sideLength, sideLength);
  pop();

  // 6) Arrow circle
  centerArrowBall.updateAngle(arrowEaseDuration);
  centerArrowBall.show();

  // 7) Fade out balls if needed
  let fadeBallsAlpha = 1; 
  if (isFadingBalls) {
    let nowSec = millis()/1000;
    let t = (nowSec - fadeBallsStartTime)/fadeBallsDuration;
    if (t >= 1) {
      // Completed fade => remove all
      for (let lb of letterBalls) {
        World.remove(world, lb.body);
      }
      letterBalls = [];
      phraseIndex = 0;
      // Reset top text fade
      for (let i = 0; i < phrase.length; i++){
        letterAlphas[i] = 51;
        letterSpawnTimes[i] = null;
      }
      isFadingBalls = false;
      // Return arrow to mouse
      centerArrowBall.setTargetToMouse();
    } else {
      fadeBallsAlpha = 1 - t; 
    }
  }

  // 8) Draw letter balls, possibly with fadeBallsAlpha
  for (let lb of letterBalls) {
    lb.show(fadeBallsAlpha);
  }

  // 9) Ghost ball
  updateGhostBallScale();
  drawPreviewBall();

  // 10) Update top phrase fade in
  updateLetterFade();
}

// ------------------------------------------------------------
// MOUSE
// ------------------------------------------------------------
function mousePressed() {
  // If we are already fading balls, do nothing
  if (isFadingBalls) return;

  // Only spawn if inside rotating square
  if (!isInsideRotatingSquare(mouseX, mouseY)) return;

  if (phraseIndex < phrase.length) {
    let c = phrase[phraseIndex];
    let upperC = c.toUpperCase();
    createLetterBall(mouseX - 20, mouseY - 30, upperC); 
    // offset: 10px up & left if you want (like your code)

    letterSpawnTimes[phraseIndex] = millis()/1000;
    phraseIndex++;

    // If we just spawned the last character, start fadeBalls
    if (phraseIndex === phrase.length) {
      startFadingBalls();
    }
  }
}

// Start the fade of all existing balls
function startFadingBalls() {
  isFadingBalls = true;
  fadeBallsStartTime = millis()/1000;
}

// ------------------------------------------------------------
// CREATE SQUARE WALLS
// ------------------------------------------------------------
function createSquareWalls(cx, cy, side) {
  let group = Composite.create();
  let thick = 100;

  let half = side / 2;
  let topWall    = Bodies.rectangle(cx, cy - half - thick/2, side, thick, { isStatic: true });
  let bottomWall = Bodies.rectangle(cx, cy + half + thick/2, side, thick, { isStatic: true });
  let leftWall   = Bodies.rectangle(cx - half - thick/2, cy, thick, side, { isStatic: true });
  let rightWall  = Bodies.rectangle(cx + half + thick/2, cy, thick, side, { isStatic: true });

  Composite.add(group, [topWall, bottomWall, leftWall, rightWall]);
  return group;
}

// ------------------------------------------------------------
// CREATE LETTER BALL
// ------------------------------------------------------------
function createLetterBall(x, y, letter) {
  let options = {
    friction: physicsConfig.friction,
    frictionAir: physicsConfig.airDrag,
    density: physicsConfig.density,
    restitution: physicsConfig.restitution
  };
  let body = Bodies.circle(x, y, 20, options);
  let lb = new LetterBall(body, letter, phraseIndex);
  letterBalls.push(lb);
  World.add(world, body);

  centerArrowBall.setTargetBall(lb);
}

// ------------------------------------------------------------
// LetterBall Class
//  - We pass fadeBallsAlpha from draw() if we are fading them out
// ------------------------------------------------------------
class LetterBall {
  constructor(body, letter, phraseIdx) {
    this.body = body;
    this.letter = letter;  // uppercase
    this.r = 20;
    this.phraseIdx = phraseIdx; // which character index in the phrase
  }

  show(fadeAlpha=1) {
    let pos = this.body.position;
    let angle = this.body.angle;

    // Check if THIS letter's phrase index is in highlightIndices
    let isHighlight = highlightIndices.includes(this.phraseIdx);

    // Assign fill colors
    let ballFill = isHighlight ? highlightBallFill : defaultBallFill;
    let textFill = isHighlight ? highlightTextFill : defaultTextFill;

    push();
    translate(pos.x, pos.y);
    rotate(angle);

    noStroke();
    // We can handle grayscale array or color array with possible length 1..4
    // Convert them to RGBA with alpha = 255*fadeAlpha
    fill(...ballFill, 255*fadeAlpha);
    ellipse(0, 0, this.r * 2);

    fill(...textFill, 255*fadeAlpha);
    textSize(this.r);
    let w = textWidth(this.letter);
    let a = textAscent();
    let d = textDescent();
    textAlign(LEFT, BASELINE);
    text(this.letter, -w/2, (a - d)/2);

    pop();
  }
}

// ------------------------------------------------------------
// CenterArrowBall
//  - now uses arrowCircleColor & arrowGlyphColor
// ------------------------------------------------------------
class CenterArrowBall {
  constructor(x, y, r) {
    this.r = r;
    this.body = Bodies.circle(x, y, r, { isStatic: true, restitution: 0.8 });
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
    this.easingStartTime = millis()/1000;
    this.easeFromAngle = this.currentAngle;
  }

  updateAngle(easeDur) {
    let pos = this.body.position;
    let nowSec = millis()/1000;
    let liveAngle;
    if (this.target === "mouse") {
      liveAngle = atan2(mouseY - pos.y, mouseX - pos.x);
    } else {
      let bPos = this.target.body.position;
      liveAngle = atan2(bPos.y - pos.y, bPos.x - pos.x);
    }

    if (this.arrowState === "EASING") {
      let t = (nowSec - this.easingStartTime)/easeDur;
      if (t >= 1) {
        t = 1;
        this.arrowState = (this.target === "mouse") ? "TRACKING_MOUSE" : "TRACKING_BALL";
      }
      let eased = easeInOutQuad(t);
      this.currentAngle = lerpAngle(this.easeFromAngle, liveAngle, eased);
    }
    else if (this.arrowState === "TRACKING_MOUSE") {
      this.currentAngle = liveAngle;
    }
    else if (this.arrowState === "TRACKING_BALL") {
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
    ellipse(0, 0, this.r*2);

    fill(...arrowGlyphColor);
    let arrowGlyph = "→";
    textSize(this.r);
    let w = textWidth(arrowGlyph);
    let a = textAscent();
    let d = textDescent();
    textAlign(LEFT, BASELINE);
    text(arrowGlyph, -w/2, (a - d)/2);

    pop();
  }
}

// ------------------------------------------------------------
// Draw the left multi-line phrase with partial fade
// ------------------------------------------------------------
function drawLeftPhrase() {
  textSize(20);
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
    // skip the \n char
    globalIndex++;
    y += lineHeight;
  }
}

// ------------------------------------------------------------
// Fade from alpha=51 -> 255 for each spawned char
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
// Ghost ball: shrinks to 0 if mouse is outside the square
// ------------------------------------------------------------
function updateGhostBallScale() {
  let inside = isInsideRotatingSquare(mouseX, mouseY);
  let speed = 0.5; // how quickly the ghost ball scale changes
  if (inside) {
    ghostBallScale = lerp(ghostBallScale, 1, 0.15);
  } else {
    ghostBallScale = lerp(ghostBallScale, 0, 1);
  }
}

function drawPreviewBall() {
  let pos = previewBody.position;
  push();
  translate(pos.x, pos.y);
  rotate(previewBody.angle);

  // scale down if outside
  scale(ghostBallScale);

  noStroke();
  fill(...ghostBallFill);
  ellipse(0, 0, 60);

  if (phraseIndex < phrase.length) {
    let nextLetter = phrase[phraseIndex].toUpperCase();
    fill(...ghostTextFill);
    textSize(25);
    let w = textWidth(nextLetter);
    let a = textAscent();
    let d = textDescent();
    textAlign(LEFT, BASELINE);
    text(nextLetter, -w/2, (a-d)/2);
  }
  pop();
}

// ------------------------------------------------------------
// EXACT SUBSTRING-FINDING for "NoamSadi" ignoring spaces
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
// isInsideRotatingSquare
// ------------------------------------------------------------
function isInsideRotatingSquare(mx, my) {
  let cx = centerArrowBall.body.position.x;
  let cy = centerArrowBall.body.position.y;
  let localX = mx - cx;
  let localY = my - cy;

  let angleRad = radians(-currentAngle);
  let cosA = cos(angleRad);
  let sinA = sin(angleRad);

  let rx = localX*cosA - localY*sinA;
  let ry = localX*sinA + localY*cosA;

  return (rx >= -halfSide && rx <= halfSide && ry >= -halfSide && ry <= halfSide);
}

// ------------------------------------------------------------
// EASING
// ------------------------------------------------------------
function easeInOutQuad(t) {
  if (t < 0.5) return 2*t*t;
  return -1 + (4 - 2*t)*t;
}
function lerpAngle(a0, a1, amt) {
  return a0 + (a1 - a0)*amt;
}
