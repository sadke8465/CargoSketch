// --------------------------------------------------------------------------
// HELPER FUNCTIONS & GLOBAL DETECTION
// --------------------------------------------------------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();

  if (!MOBILE_MODE) {
    // Remove and recreate the static walls
    Composite.remove(desktopWorld, wallComposite);
    wallComposite = createRectWalls(leftPanelCenterX, leftPanelCenterY, leftPanelW, leftPanelH);
    World.add(desktopWorld, wallComposite);
    
    // Remove the old center arrow ball and create a new one with updated scale
    Composite.remove(desktopWorld, centerArrowBall.body);
    centerArrowBall = new CenterArrowBall(leftPanelCenterX, leftPanelCenterY, 40 * scaleFactor);
    World.add(desktopWorld, centerArrowBall.body);
    
    // Update preview ball position (if needed)
    Matter.Body.setPosition(previewBody, { x: mouseX - ghostBallOffset.x, y: mouseY - ghostBallOffset.y });
    
    // Update any other physics objects that depend on layout or scaleFactor here...
  }
}

// 1) Detect if mobile device (simple check)
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone|Opera Mini|Mobile/i.test(navigator.userAgent);
}

// 2) Easing functions
function easeInOutQuad(t) {
  if (t < 0.5) return 2 * t * t;
  return -1 + (4 - 2 * t) * t;
}

function lerpAngle(a0, a1, t) {
  let diff = a1 - a0;
  while (diff < -PI) diff += TWO_PI;
  while (diff > PI) diff -= TWO_PI;
  return a0 + diff * t;
}

// Easing function for description fade (in/out sine)
function easeInOutSine(t) {
  return -(cos(PI * t) - 1) / 2;
}

// NEW: Easing function for gallery scroll transition (in/out quint)
function easeInOutQuint(t) {
  return t < 0.5 ? 16 * t*t*t*t*t : 1 - Math.pow(-2 * t + 2, 5) / 2;
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
let transitionOffsetStart = 100; // Starting offset (adjust as needed)
let transitionOffset = 0;        // This will be computed during the transition

// --------------------------------------------------------------------------
// TEXT SCALE!!!!!!!!!!!!!!
// --------------------------------------------------------------------------
let TEXTSCALE = 17;
let expandedImageIndex = 0;   // The index of the expanded image in projectGalleryImages
let galleryImageBoxes = [];   // To store bounding boxes for gallery images (used for click detection)
let targetScrollOffset = 0; // The scroll offset we want to reach

// --------------------------------------------------------------------------
// Additional globals for left panel transition and gallery view:
// --------------------------------------------------------------------------
let leftPanelMode = "physics";  // "physics" | "transition" | "gallery" | "expanded"
let physicsAlpha = 255;         // Opacity for physics simulation (0-255)
let galleryAlpha = 0;           // Opacity for gallery (0-255)
let fadeStartTime = null;       // Time when fade transition started
let fadeDuration = 1.0;         // Duration of fade transition (seconds)
let activeProject = null;       // The project that is currently active
let projectGalleryImages = [];  // Array of gallery media items (each with type, src, etc.)
let scrollOffset = 0;           // Vertical scroll offset for the gallery

// New globals for project description overlay:
let projectDescriptionFadeStartTime = 0;  // time in seconds when fade started
let projectDescriptionFadeDuration = 1.0;   // Fade duration in seconds

// NEW globals for gallery transition (when switching projects)
let galleryTransitionActive = false;
let galleryTransitionStartTime = 0;
let galleryTransitionDuration = 1; // seconds
let oldGalleryImages = [];  // holds outgoing project media
let newGalleryImages = [];  // holds incoming project media
let oldScrollOffset = 0;    // scroll offset at moment of transition
let upcomingProject = null; // new project to switch to

// --------------------------------------------------------------------------
// Matter.js engines/worlds
// --------------------------------------------------------------------------
let desktopEngine, desktopWorld;
let mobileEngine, mobileWorld;

// --------------------------------------------------------------------------
// DESKTOP MODE GLOBALS
// --------------------------------------------------------------------------
// Define your projects
let projectIndex = [
  {
    name: "A Book on Books",
    url: "project1.html",
    glyph: "    ①  ",
    tags: ["Book Design", "Archive"],
    description: "A deep dive into archival design and typography.",
    media: [
      { type: "image", src: "p1_a.jpg" },
      { type: "image", src: "p1_b.jpg" },
    ]
  },
  {
    name: "Graduation Show Branding",
    url: "project2.html",
    glyph: "    ②  ",
    tags: ["Motion Design", "Generative", "Touchdesigner"],
    description: "A dynamic and generative branding project.",
    media: [
      { type: "image", src: "p2_a.jpg" },
      { type: "image", src: "p2_b.jpg" },
      { type: "image", src: "p2_c.jpg" },
    ]
  },
  {
    name: "Wix Holidays Moving Posters",
    url: "project3.html",
    glyph: "    ③  ",
    tags: ["Interactive Experience", "Creative Coding"],
    description: "An interactive exploration of festive moving posters.",
    media: [
      { type: "image", src: "p3_a.webp" },
      { type: "image", src: "p3_b.jpg" },
      { type: "video", src: "p3_c_v.mp4" }
    ]
  }
];


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
let letterBallSize = 18;            
let letterBallTextSize = 14;        
let letterBallColor = [170];        
let letterBallTextColor = [0];      

// Styling for final text circle:
let textBallSize = 110;             
let textBallColor = [255];          
let textBallTextSize = 14;          
let textBallTextColor = [0];        

// Styling for "Enable Motion" circle:
let enableMotionBallColor = [255];  
let enableMotionTextColor = [0];    
let enableMotionText = "Enable Motion";

// Background colors:
let enableMotionBackgroundColor = [80];
let regularBackgroundColor = [255, 235, 59];

// Final text for final text circle:
let finalTextBallText = "This site is best viewed\non a desktop device\n\n☺\n\nClick here to contact!";

// Mobile state machine states:
let mobileState = "ENABLE_MOTION";
let enableMotionAlpha = 255;
let finalTextAlpha = 255;
let bgColorFrom = [...enableMotionBackgroundColor];
let bgColorTo = [...regularBackgroundColor];

// Mobile letter balls (spawn after transition)
let mobileBalls = [];
let mobileLettersToSpawn = [];
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

function enterExpandedMode(index) {
  leftPanelMode = "expanded";
  expandedImageIndex = index;
  noCursor();
}

function drawExpandedImage() {
  background(...backgroundColor);
  let imgX = 50;
  let imgY = 50;
  let imgW = width - 100;
  let imgH = height - 100;
  let img = projectGalleryImages[expandedImageIndex];
  image(img, imgX, imgY, imgW, imgH);
  
  let drawArrow = false;
  let arrowSymbol = "";
  
  if (mouseX < width / 2) {
    if (expandedImageIndex > 0) {
      drawArrow = true;
      arrowSymbol = "←";
    }
  } else {
    if (expandedImageIndex < projectGalleryImages.length - 1) {
      drawArrow = true;
      arrowSymbol = "→";
    }
  }
  
  if (drawArrow) {
    noCursor();
  } else {
    cursor(ARROW);
  }
  
  if (drawArrow) {
    fill(255);
    textSize(64);
    textAlign(CENTER, CENTER);
    text(arrowSymbol, mouseX, mouseY);
  }
  
  let xButtonSize = 30;
  fill(0, 200);
  noStroke();
  rect(10, 10, xButtonSize, xButtonSize, 5);
  fill(255);
  textSize(20);
  textAlign(CENTER, CENTER);
  text("×", 10 + xButtonSize / 2, 10 + xButtonSize / 2);
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
  
  push();
  // Only draw the physics simulation background when in "physics" mode and not during a gallery transition.
  if (!galleryTransitionActive && leftPanelMode === "physics") {
    push();
    fill(255, physicsAlpha);
    rect(leftPanelX, leftPanelY, leftPanelW, leftPanelH);
    pop();
  }
  
  // If in transition from physics to gallery (or if already in gallery)...
  if (leftPanelMode === "transition" || leftPanelMode === "gallery") {
    // If a gallery transition (when switching projects) is active, handle that:
    if (galleryTransitionActive) {
      let nowSec = millis() / 1000; // use seconds consistently
      let t = constrain((nowSec - galleryTransitionStartTime) / galleryTransitionDuration, 0, 1);
      let easeT = easeInOutQuint(t);
      // Animate our dedicated transition offset from transitionOffsetStart to 0:
      transitionOffset = lerp(transitionOffsetStart, 0, easeT);
      let oldAlpha = lerp(255, 0, t);
      let newAlpha = lerp(0, 255, t);
      // Pass the transitionOffset to draw the old gallery images.
      drawGalleryImages(oldGalleryImages, oldAlpha, transitionOffset);
      // New gallery images remain at offset 0.
      drawGalleryImages(newGalleryImages, newAlpha, 0);
      if (t >= 1) {
        galleryTransitionActive = false;
        activeProject = upcomingProject;
        projectGalleryImages = newGalleryImages.slice();
      }
      return;
    }
                
    // Otherwise, use the physics-to-gallery fade transition.
    let nowSec = millis() / 1000;
    let t = constrain((nowSec - fadeStartTime) / fadeDuration, 0, 1);
    let eased = easeInOutQuad(t);
    physicsAlpha = lerp(255, 0, eased);
    galleryAlpha = lerp(0, 255, eased);
    
    if (t >= 1) {
      leftPanelMode = "gallery";
    }
    drawGallery(galleryAlpha);
  }
  
  pop();
  
  // Right panel drawing.
  fill(255);
  rect(rightPanelX, rightPanelY, rightPanelW, rightPanelH);
  
  if (leftPanelMode === "physics") {
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
  
  if (activeProject !== null) {
    drawProjectDescriptionOverlay();
  }
  
  drawProjectIndex();
  push();
  fill('red');
  textSize(20);
  textAlign(CENTER, BOTTOM);
  text("Transition Offset: " + nf(transitionOffset, 1, 2) + " | FPS: " + nf(frameRate(), 1, 2), width / 2, height - 10);
  pop();
  pop();

}

function startGalleryTransition(proj) {
  projectDescriptionFadeStartTime = millis() / 1000;

  if (activeProject !== null && activeProject !== proj) {
    galleryTransitionActive = true;
    galleryTransitionStartTime = millis() / 1000;
    galleryTransitionDuration = fadeDuration;
    // Capture the current scroll offset of the old gallery
    oldScrollOffset = scrollOffset;
    
    // Force the transition offset to a known starting value (if needed)
    // (You can remove transitionOffsetStart if not using it for this purpose.)
    // transitionOffset = transitionOffsetStart;
    
    oldGalleryImages = projectGalleryImages.slice(); // copy current media
    
    if (!proj.media || proj.media.length === 0) {
      proj.media = [];
      for (let i = 1; i <= 3; i++) {
        let pg = createGraphics(200, 150);
        pg.background(200);
        pg.textSize(32);
        pg.fill(0);
        pg.text("Test " + i, 50, 75);
        proj.media.push({ type: "image", src: "", img: pg });
      }
    }
    newGalleryImages = proj.media.slice();
    upcomingProject = proj;
    leftPanelMode = "transition";
  } else {
    leftPanelMode = "transition";
    fadeStartTime = millis() / 1000;
    scrollOffset = 0;
    if (!proj.media || proj.media.length === 0) {
      // Create dummy media if needed...
    }
    projectGalleryImages = proj.media.slice();
    activeProject = proj;
  }
}


function drawGallery(alphaVal) {
  galleryImageBoxes = []; // Clear previous boxes
  
  // If in a gallery transition between projects:
  if (galleryTransitionActive) {
    let nowSec = millis() / 1000; // use seconds consistently
    let t = constrain((nowSec - galleryTransitionStartTime) / galleryTransitionDuration, 0, 1);
    let easeT = easeInOutQuint(t);
    
    // Animate the scroll offset from the old scroll offset to 0 (new gallery's start)
    let animatedScroll = lerp(oldScrollOffset, 0, easeT);
    
    let oldAlpha = lerp(255, 0, t);
    let newAlpha = lerp(0, 255, t);
    
    // Draw the old gallery images with the animated scroll offset.
    drawGalleryImages(oldGalleryImages, oldAlpha, animatedScroll);
    
    // New gallery images remain at offset 0.
    drawGalleryImages(newGalleryImages, newAlpha, 0);
    
    if (t >= 1) {
      galleryTransitionActive = false;
      activeProject = upcomingProject;
      projectGalleryImages = newGalleryImages.slice();
    }
    return;
  }
    
  // Otherwise, normal gallery drawing:
  let mediaItems = activeProject.media;
  if (!mediaItems || mediaItems.length === 0) {
    fill(0, alphaVal);
    textSize(20);
    text("No media available", leftPanelX + 20, 20);
    return;
  }
  
  // Use the global scrollOffset for normal gallery scrolling
  scrollOffset = lerp(scrollOffset, targetScrollOffset, 0.5);

  let y = rightPanelY + scrollOffset;
  let spacing = 20;
  let maxMediaWidth = leftPanelW - 40;
  
  for (let i = 0; i < mediaItems.length; i++) {
    let item = mediaItems[i];
    let displayWidth = maxMediaWidth;
    let displayHeight = 0;
    
    if (item.type === "image") {
      if (!item.img) {
        item.img = loadImage(item.src);
      }
      let scaleVal = displayWidth / item.img.width;
      displayHeight = item.img.height * scaleVal;
      galleryImageBoxes.push({ x: leftPanelX + 20, y: y, w: displayWidth, h: displayHeight, index: i });
      tint(255, alphaVal);
      image(item.img, leftPanelX + 20, y, displayWidth, displayHeight);
    } else if (item.type === "video") {
      let vid;
      if (!item.video) {
        vid = createVideo(item.src);
        vid.elt.setAttribute("playsinline", "");
        vid.volume(0);
        vid.loop();
        vid.hide();
        item.video = vid;
      } else {
        vid = item.video;
      }
      let vWidth = vid.elt.videoWidth || 640;
      let vHeight = vid.elt.videoHeight || 360;
      let scaleVal = displayWidth / vWidth;
      displayHeight = vHeight * scaleVal;
      galleryImageBoxes.push({ x: leftPanelX + 20, y: y, w: displayWidth, h: displayHeight, index: i });
      let videoFrame = vid.get();
      tint(255, alphaVal);
      image(videoFrame, leftPanelX + 20, y, displayWidth, displayHeight);
      if (vid.elt.paused) {
        vid.play();
      }
    }
    y += displayHeight + spacing;
  }
}

// NEW: Helper to draw gallery media from an array with a given tint alpha.
function drawGalleryImages(imageArray, tintAlpha, offset) {
  let y = rightPanelY + offset;
  let spacing = 20;
  let maxMediaWidth = leftPanelW - 40;
  
  for (let i = 0; i < imageArray.length; i++) {
    let item = imageArray[i];
    let displayWidth = maxMediaWidth;
    let displayHeight = 0;
    
    if (item.type === "image") {
      if (!item.img) {
        item.img = loadImage(item.src);
      }
      let scaleVal = displayWidth / item.img.width;
      displayHeight = item.img.height * scaleVal;
      galleryImageBoxes.push({ x: leftPanelX + 20, y: y, w: displayWidth, h: displayHeight, index: i });
      tint(255, tintAlpha);
      image(item.img, leftPanelX + 20, y, displayWidth, displayHeight);
    } else if (item.type === "video") {
      let vid;
      if (!item.video) {
        vid = createVideo(item.src);
        vid.elt.setAttribute("playsinline", "");
        vid.volume(0);
        vid.loop();
        vid.hide();
        item.video = vid;
      } else {
        vid = item.video;
      }
      let vWidth = vid.elt.videoWidth || 640;
      let vHeight = vid.elt.videoHeight || 360;
      let scaleVal = displayWidth / vWidth;
      displayHeight = vHeight * scaleVal;
      galleryImageBoxes.push({ x: leftPanelX + 20, y: y, w: displayWidth, h: displayHeight, index: i });
      let videoFrame = vid.get();
      tint(255, tintAlpha);
      image(videoFrame, leftPanelX + 20, y, displayWidth, displayHeight);
      if (vid.elt.paused) {
        vid.play();
      }
    }
    y += displayHeight + spacing;
  }
}

function drawProjectDescriptionOverlay() {
  let lines = phrase.split("\n");
  let overlayX = phraseX;
  let overlayY = phraseY;
  let overlayW = rightPanelW - 2 * phrasePadding;
  let overlayH = lines.length * (30 * scaleFactor);

  noStroke();
  fill(255);
  rect(overlayX, overlayY, overlayW, overlayH);

  let elapsed = (millis() / 1000) - projectDescriptionFadeStartTime;
  let t = constrain(elapsed / projectDescriptionFadeDuration, 0, 1);
  let fadeAlpha = easeInOutSine(t);

  textSize(TEXTSCALE * scaleFactor);
  textAlign(LEFT, TOP);
  fill(...phraseTextColor, fadeAlpha * 255);
  let desc = activeProject.description ? activeProject.description : ("Description for " + activeProject.name);
  text(desc, overlayX, overlayY, overlayW, overlayH);
}

function mouseWheel(event) {
  if (galleryTransitionActive) return;
  if (leftPanelMode === "gallery") {
    // Update the target scroll offset based on the mouse wheel delta.
    targetScrollOffset -= event.delta;
  }
}

function mousePressed() {
  if (leftPanelMode === "gallery") {
    for (let box of galleryImageBoxes) {
      if (
        mouseX >= box.x &&
        mouseX <= box.x + box.w &&
        mouseY >= box.y &&
        mouseY <= box.y + box.h
      ) {
        enterExpandedMode(box.index);
        return;
      }
    }
  }
  
  if (leftPanelMode === "expanded") {
    if (mouseX >= 10 && mouseX <= 40 && mouseY >= 10 && mouseY <= 40) {
      leftPanelMode = "gallery";
      cursor(ARROW);
      return;
    }
    if (mouseX < width / 2 && expandedImageIndex > 0) {
      expandedImageIndex--;
      return;
    }
    if (mouseX >= width / 2 && expandedImageIndex < projectGalleryImages.length - 1) {
      expandedImageIndex++;
      return;
    }
    return;
  }
  
  if (!MOBILE_MODE) {
    let a = textAscent();
    let d = textDescent();
    let textHeight = a + d;
    let hitMargin = 9 * scaleFactor;
    for (let proj of projectIndex) {
      if (
        mouseX >= proj.x &&
        mouseX <= proj.x + proj.lineWidth &&
        mouseY >= proj.y - hitMargin &&
        mouseY <= proj.y - hitMargin + textHeight + 2 * hitMargin
      ) {
        console.log("Project clicked:", proj.name);
        activeProject = proj;
        projectDescriptionFadeStartTime = millis() / 1000;
        startGalleryTransition(proj);
        return;
      }
    }
  }
  
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
  let r = random(18, 30) * scaleFactor;
  let options = {
    friction: physicsConfigDesktop.friction,
    frictionAir: physicsConfigDesktop.airDrag,
    density: physicsConfigDesktop.density,
    restitution: physicsConfigDesktop.restitution
  };
  let body = Bodies.circle(x, y, r, options);
  let lb = new LetterBall(body, letter, phraseIndex, r);
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
  textSize(TEXTSCALE * scaleFactor);
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

function drawProjectIndex() {
  let indexTextSize = TEXTSCALE * scaleFactor;
  textSize(indexTextSize);
  textAlign(LEFT, TOP);
  let arrowInitialOffset = 25 * scaleFactor;
  let a = textAscent();
  let d = textDescent();
  let textHeight = a + d;
  let padding = 10 * scaleFactor;
  let baseX = rightPanelX + padding;
  let lineSpacing = textHeight + (20 * scaleFactor);
  let hitMargin = 9 * scaleFactor;
  let totalHeight = projectIndex.length * lineSpacing;
  let startY = rightPanelY + rightPanelH - padding - totalHeight;
  let anyHovered = false;
  
  for (let i = 0; i < projectIndex.length; i++) {
    let proj = projectIndex[i];
    if (proj.offset === undefined) proj.offset = 0;
    if (proj.alpha === undefined) proj.alpha = 255;
    proj.y = startY + i * lineSpacing;
    proj.x = baseX + proj.offset;
    
    let glyphW = textWidth(proj.glyph);
    let nameW = textWidth(proj.name);
    let tagsStr = " / " + proj.tags.join(" / ");
    let tagsW = textWidth(tagsStr);
    proj.lineWidth = glyphW + 8 + nameW + 8 + tagsW;
    
    let boxX = proj.x;
    let boxY = proj.y - hitMargin;
    let boxW = proj.lineWidth;
    let boxH = textHeight + hitMargin * 2;
    
    if (proj === activeProject) {
      proj.hovered = true;
    } else {
      proj.hovered = (mouseX >= boxX &&
                      mouseX <= boxX + boxW &&
                      mouseY >= boxY &&
                      mouseY <= boxY + boxH);
    }
    if (proj.hovered) {
      anyHovered = true;
    }
  }
  
  let actualIndexHover = false;
  for (let proj of projectIndex) {
    let hm = 9 * scaleFactor;
    let bx = proj.x;
    let by = proj.y - hm;
    let bw = proj.lineWidth;
    let localTextHeight = textAscent() + textDescent();
    let bh = localTextHeight + hm * 2;
    if (
      mouseX >= bx &&
      mouseX <= bx + bw &&
      mouseY >= by &&
      mouseY <= by + bh
    ) {
      actualIndexHover = true;
      break;
    }
  }
  
  if (mouseX >= rightPanelX && mouseX <= rightPanelX + rightPanelW) {
    if (actualIndexHover) {
      cursor(HAND);
    } else {
      cursor(ARROW);
    }
  }
  
  for (let proj of projectIndex) {
    if (proj.textOffset === undefined) proj.textOffset = 0;
    if (proj.arrowOffset === undefined) proj.arrowOffset = 0;
    let targetTextOffset = 0;
    let targetArrowOffset = 0;
    let targetGlyphAlpha = 255;
    let targetNameAlpha = 255;
    let targetTagsAlpha = 51;
    if (anyHovered) {
      if (proj.hovered) {
        targetGlyphAlpha = 255;
        targetNameAlpha = 255;
        targetTagsAlpha = 255;
        targetTextOffset = 50;
        targetArrowOffset = 25;
      } else {
        targetGlyphAlpha = 51;
        targetNameAlpha = 51;
        targetTagsAlpha = 51;
        targetTextOffset = 0;
        targetArrowOffset = 0;
      }
    }
    proj.textOffset = lerp(proj.textOffset, targetTextOffset, 0.2);
    proj.arrowOffset = lerp(proj.arrowOffset, targetArrowOffset, 0.2);
    proj.glyphAlpha = lerp(proj.glyphAlpha || 255, targetGlyphAlpha, 0.2);
    proj.nameAlpha = lerp(proj.nameAlpha || 255, targetNameAlpha, 0.2);
    proj.tagsAlpha = lerp(proj.tagsAlpha || 51, targetTagsAlpha, 0.2);
  }
  
  for (let proj of projectIndex) {
    let lineX = baseX + proj.textOffset;
    let lineY = proj.y;
    if (proj.hovered) {
      let arrow = "→  ";
      let arrowW = textWidth(arrow);
      let arrowX = (baseX + arrowInitialOffset) + proj.arrowOffset - arrowW;
      fill(0, 255);
      text(arrow, arrowX, proj.y);
    }
    fill(0, proj.glyphAlpha);
    text(proj.glyph, lineX, lineY);
    let glyphW = textWidth(proj.glyph);
    let xAfterGlyph = lineX + glyphW + 8;
    fill(0, proj.nameAlpha);
    text(proj.name, xAfterGlyph, lineY);
    let nameW = textWidth(proj.name);
    let xAfterName = xAfterGlyph + nameW + 8;
    let tagsStr = " / " + proj.tags.join(" / ");
    fill(0, proj.tagsAlpha);
    text(tagsStr, xAfterName, lineY);
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
  constructor(body, letter, phraseIdx, r) {
    this.body = body;
    this.letter = letter;
    this.r = r;
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
// MOBILE MODE FUNCTIONS
// ===========================================================================
function setupMobile() {
  createCanvas(windowWidth, windowHeight);
  mobileEngine = Engine.create();
  mobileWorld = mobileEngine.world;
  mobileEngine.world.gravity.x = 0;
  mobileEngine.world.gravity.y = 0;
  
  let group = Composite.create();
  let thick = 200;
  let topWall = Bodies.rectangle(width / 2, -thick / 2, width + thick * 2, thick, { isStatic: true });
  let bottomWall = Bodies.rectangle(width / 2, height + thick / 2, width + thick * 2, thick, { isStatic: true });
  let leftWall = Bodies.rectangle(-thick / 2, height / 2, thick, height + thick * 2, { isStatic: true });
  let rightWall = Bodies.rectangle(width + thick / 2, height / 2, thick, height + thick * 2, { isStatic: true });
  Composite.add(group, [topWall, bottomWall, leftWall, rightWall]);
  World.add(mobileWorld, group);
  
  mobileCircleBody = Bodies.circle(width / 2, height / 2, textBallSize, { isStatic: true });
  World.add(mobileWorld, mobileCircleBody);
  
  mobileState = "ENABLE_MOTION";
  enableMotionAlpha = 255;
  finalTextAlpha = 255;
  bgColorFrom = [...enableMotionBackgroundColor];
  bgColorTo = [...regularBackgroundColor];
  console.log("Mobile setup complete. State:", mobileState);
  
  permissionButton = createButton(enableMotionText);
  permissionButton.style('width', (textBallSize * 2) + 'px');
  permissionButton.style('height', (textBallSize * 2) + 'px');
  permissionButton.style('background-color', color(enableMotionBallColor));
  permissionButton.style('color', color(enableMotionTextColor));
  permissionButton.style('border', 'none');
  permissionButton.style('border-radius', '50%');
  permissionButton.style('font-size', textBallTextSize + 'px');
  permissionButton.style("font-family", '"Geist UltraLight", sans-serif');
  permissionButton.position(width / 2 - textBallSize, height / 2 - textBallSize);
  permissionButton.mousePressed((event) => {
    event.stopPropagation();
    requestMotionPermission();
  });
}

function drawMobile() {
  Engine.update(mobileEngine);
  
  if (mobileState === "ENABLE_MOTION") {
    background(...enableMotionBackgroundColor);
  } else if (mobileState === "SHOW_TEXT_BALL") {
    background(...regularBackgroundColor);
    drawFinalTextCircle(255);
    for (let b of mobileBalls) {
      b.show();
    }
  }
}

function mousePressedMobile() {
  if (mobileState === "ENABLE_MOTION") return;
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
          startTransition();
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

function handleDeviceOrientation(event) {
  if (!event.beta || !event.gamma || !event.alpha) return;
  let targetAngle = radians(event.alpha);
  mobileBigCircleAngle = lerpAngle(mobileBigCircleAngle, targetAngle, 0.1);
  mobileEngine.world.gravity.x = map(event.gamma, -90, 90, -1, 1);
  mobileEngine.world.gravity.y = map(event.beta, -90, 90, -1, 1);
}

function handleDeviceMotion(event) {
  let acc = event.acceleration;
  if (!acc) return;
  let magnitude = sqrt(
    (acc.x || 0) * (acc.x || 0) +
    (acc.y || 0) * (acc.y || 0) +
    (acc.z || 0) * (acc.z || 0)
  );
  const threshold = 5;
  if (magnitude > threshold) {
    let forceScale = 0.0005;
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
    text(this.letter, 0, -this.r * 0.1);
    pop();
  }
}
