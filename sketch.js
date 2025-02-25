// --------------------------------------------------------------------------
// HELPER FUNCTIONS & GLOBAL DETECTION
// --------------------------------------------------------------------------
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateLayout();  // This updates all your panel positions and dimensions

  // Update HTML gallery dimensions and position
  if (htmlGallery) {
    // Update gallery container
    htmlGallery.style('left', leftPanelX + 'px');
    htmlGallery.style('width', leftPanelW + 'px');
    htmlGallery.style('height', '100vh');
    
    // Update content container position to match panel Y position
    const contentContainer = document.getElementById('galleryContent');
    if (contentContainer) {
      contentContainer.style.marginTop = leftPanelY + 'px';
    }
    
    // Ensure gallery items stay within bounds
    const galleryItems = htmlGallery.elt.getElementsByClassName('gallery-item');
    for (let item of galleryItems) {
      item.style.maxWidth = '100%';
      item.style.height = 'auto';
    }

    // Re-calculate scroll position to maintain relative position
    const scrollPercentage = htmlGallery.elt.scrollTop / htmlGallery.elt.scrollHeight;
    const newScrollPosition = scrollPercentage * htmlGallery.elt.scrollHeight;
    htmlGallery.elt.scrollTop = newScrollPosition;
  }

  // Update HTML description position and dimensions
  if (htmlDescription) {
    htmlDescription.position(phraseX, phraseY);
    htmlDescription.style('width', (rightPanelW - 2 * phrasePadding) + 'px');
    htmlDescription.style('font-size', (TEXTSCALE * scaleFactor) + 'px');
  }
  updateBackButtonPosition();

  // Update physics simulation if in physics mode
  if (!MOBILE_MODE) {
    // Remove and recreate the static walls
    Composite.remove(desktopWorld, wallComposite);
    wallComposite = createRectWalls(leftPanelCenterX, leftPanelCenterY, leftPanelW, leftPanelH);
    World.add(desktopWorld, wallComposite);
    
    // Remove the old center arrow ball and create a new one with updated scale
    Composite.remove(desktopWorld, centerArrowBall.body);
    centerArrowBall = new CenterArrowBall(leftPanelCenterX, leftPanelCenterY, 40 * scaleFactor);
    World.add(desktopWorld, centerArrowBall.body);
    
    // Update preview ball position
    Matter.Body.setPosition(previewBody, { 
      x: mouseX - ghostBallOffset.x, 
      y: mouseY - ghostBallOffset.y 
    });
  }
}

// 1) Detect if mobile device (simple check)
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone|Opera Mini|Mobile/i.test(navigator.userAgent);
}

// 2) Easing functions
function easeInOutQuint(t) {
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
let targetScrollY = 0;
let currentScrollY = 0;
let scrollVelocity = 0;
const SCROLL_EASE = 0.1;
const SCROLL_FRICTION = 0.95;
const SCROLL_SENSITIVITY = 0.01;

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
let targetScrollOffset = 0; // The scroll offset we want to reach

// --------------------------------------------------------------------------
// Additional globals for left panel transition and gallery view:
// --------------------------------------------------------------------------
let leftPanelMode = "physics";  // "physics" | "transition" | "gallery" | "htmlGallery"
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

// NEW global: Alpha value for covering the physics simulation when a project is open.
let physicsCoverAlpha = 0;

// --------------------------------------------------------------------------
// Matter.js engines/worlds
// --------------------------------------------------------------------------
let desktopEngine, desktopWorld;
let mobileEngine, mobileWorld;
let expandedOverlay;        // The full-screen overlay
let expandedImage;          // The <img> or <video> element shown in overlay
let expandedCloseButton;    // The "X" close button
let expandedItems = [];     // Array of all items in the gallery (images & videos)
let currentExpandedIndex = -1; // Which photo/video is open (-1 means none)

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
    description: "Final Work at Shenkar: A Book on Books<br>This project marks the culmination of my academic journey at Shenkar, where I delved deep into the evolution of book design and the printed word.<br>It involved extensive archival research, unearthing historical treasures and reinterpreting classic design principles to forge a new visual narrative.<br>The work merges modern typography with traditional printing techniques, creating a unique dialogue between past and present.<br>Each page is crafted to challenge conventional layouts, inviting the reader to explore the intricate relationship between form and content.<br>Ultimately, this project is a celebration of literary culture, blending art, history, and technology to redefine the boundaries of book-making.",
    media: [
{ type: "image", src: "PAGMAR_29_Full.png" },
{ type: "video", src: "Wix_Sukot_WIP3.mp4" },

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
let backgroundColor = [35];
let phraseTextColor = [0];
let highlightBallFill = [70, 200, 70];
let highlightTextFill = [255];
let defaultBallFill = [255];
let defaultTextFill = [35];
let arrowCircleColor = [35];
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
let letterBallSize = 18;            
let letterBallTextSize = 14;        
let letterBallColor = [170];        
let letterBallTextColor = [0];      

let textBallSize = 110;             
let textBallColor = [255];          
let textBallTextSize = 14;          
let textBallTextColor = [0];        

let enableMotionBallColor = [255];  
let enableMotionTextColor = [0];    
let enableMotionText = "Enable Motion";

let enableMotionBackgroundColor = [80];
let regularBackgroundColor = [80];

let finalTextBallText = "This site is best viewed\non a desktop device\n\n☺\n\nClick here to contact!";

let mobileState = "ENABLE_MOTION";
let enableMotionAlpha = 255;
let finalTextAlpha = 255;
let bgColorFrom = [...enableMotionBackgroundColor];
let bgColorTo = [...regularBackgroundColor];

let mobileBalls = [];
let mobileLettersToSpawn = [];
let mobileBigCircleAngle = 0;



let backButton;






// --------------------------------------------------------------------------
// p5.js SETUP & DRAW
// --------------------------------------------------------------------------
function preload() {
  myFont = loadFont("Geist UltraLight.otf");
  for (let i = 0; i < projectIndex.length; i++) {
    let proj = projectIndex[i];
    if (proj.media && proj.media.length > 0) {
      for (let j = 0; j < proj.media.length; j++) {
        let mediaItem = proj.media[j];
        if (mediaItem.type === "image") {
          mediaItem.img = loadImage(mediaItem.src);
        }
      }
    }
  }
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
    const style = document.createElement('style');
    style.innerHTML = `
    .gallery-item {
      cursor: pointer;
    }
    
    #expandedImage {
      pointer-events: none;
    }
  `;
      document.head.appendChild(style);

    setupDesktop();

htmlGallery = createDiv('');
htmlGallery.id('htmlGallery');

htmlGallery.style('scrollbar-width', 'none'); // Firefox
htmlGallery.style('-ms-overflow-style', 'none'); // IE/Edge
htmlGallery.style('&::-webkit-scrollbar', 'display: none'); // Chrome/Safari

htmlGallery.style('position', 'fixed');
htmlGallery.style('top', '0');
htmlGallery.style('left', leftPanelX + 'px');
htmlGallery.style('width', leftPanelW + 'px');
htmlGallery.style('height', '100vh');
htmlGallery.style('overflow-y', 'auto');
htmlGallery.style('overflow-x', 'hidden');


// Create top scroll area (300vh)
let topScrollArea = createDiv('');
topScrollArea.parent(htmlGallery);
topScrollArea.style('height', '300vh');

// Create content container with absolute positioning
let contentContainer = createDiv('');
contentContainer.parent(htmlGallery);
contentContainer.id('galleryContent');
contentContainer.style('display', 'flex');
contentContainer.style('flex-direction', 'column');
contentContainer.style('align-items', 'center');
// Position it at the same Y as the panels
contentContainer.style('margin-top', leftPanelY + 'px');

// Create bottom scroll area (300vh)
let bottomScrollArea = createDiv('');
bottomScrollArea.parent(htmlGallery);
bottomScrollArea.style('height', '300vh');

        
        
    htmlDescription = createDiv('');
    htmlDescription.id('htmlDescription');
    htmlDescription.style('font-family', 'Geist UltraLight, sans-serif');
    htmlDescription.style('position', 'absolute');
    htmlDescription.style('overflow', 'hidden');
    htmlDescription.style('background', 'rgba(255,255,255,0.8)');
    htmlDescription.position(phraseX, phraseY);
    htmlDescription.style('width', (rightPanelW - 2 * phrasePadding) + 'px');
    htmlDescription.style('opacity', '0');
    htmlDescription.style('font-size', (TEXTSCALE * scaleFactor) + 'px');
    setupScrollHandling();


    // Start with physics simulation visible.
    leftPanelMode = "physics";
    activeProject = null;
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
function updateScroll() {
  if (leftPanelMode === "htmlGallery") {
    // Apply friction to velocity
    scrollVelocity *= SCROLL_FRICTION;
    
    // Update target position based on velocity
    targetScrollY += scrollVelocity;
    
    // Clamp target
    const maxScroll = htmlGallery.elt.scrollHeight - htmlGallery.elt.clientHeight;
    targetScrollY = constrain(targetScrollY, 0, maxScroll);
    
    // Ease current position towards target
    currentScrollY = lerp(currentScrollY, targetScrollY, SCROLL_EASE);
    
    // Apply scroll
    htmlGallery.elt.scrollTop = currentScrollY;
  }
}



// ===========================================================================
// DESKTOP MODE FUNCTIONS
// ===========================================================================
function setupScrollHandling() {
  // Global wheel event listener
  window.addEventListener('wheel', (e) => {
    if (leftPanelMode === "htmlGallery") {
      e.preventDefault();
      
      // Add to target scroll with easing
      scrollVelocity += e.deltaY * SCROLL_SENSITIVITY;
      
      // Clamp target scroll to bounds
      const maxScroll = htmlGallery.elt.scrollHeight - htmlGallery.elt.clientHeight;
      targetScrollY = constrain(targetScrollY, 0, maxScroll);
    }
  }, { passive: false });
}








function openExpandedView(index) {
  currentExpandedIndex = index;
  showExpandedOverlay(index);
}

function showExpandedOverlay(index) {
  // Create the overlay if it doesn't exist yet
  if (!expandedOverlay) {
    expandedOverlay = createDiv('');
    expandedOverlay.id('expandedOverlay');
    expandedOverlay.style('position', 'fixed');
    expandedOverlay.style('top', '0');
    expandedOverlay.style('left', '0');
    expandedOverlay.style('width', '100vw');
    expandedOverlay.style('height', '100vh');
    expandedOverlay.style('background', 'rgba(0,0,0,0.9)');
    expandedOverlay.style('opacity', '0'); // start invisible
    expandedOverlay.style('z-index', '9999');
    expandedOverlay.style('overflow', 'hidden');
    expandedOverlay.style('display', 'block');

    // Create the X close button with Geist font
    expandedCloseButton = createDiv('×');
    expandedCloseButton.parent(expandedOverlay);
    expandedCloseButton.style('position', 'absolute');
    expandedCloseButton.style('top', '20px');
    expandedCloseButton.style('right', '30px');
    expandedCloseButton.style('font-size', '36px'); // Slightly larger for the multiplication symbol
    expandedCloseButton.style('color', '#fff');
    expandedCloseButton.style('cursor', 'pointer');
    expandedCloseButton.style('z-index', '10001'); // Higher z-index
    expandedCloseButton.style('padding', '10px'); // Larger hit area
    expandedCloseButton.style('font-weight', 'normal'); // Normal weight for the multiplication symbol
    expandedCloseButton.style('font-family', 'Geist UltraLight, sans-serif'); // Add Geist font
    expandedCloseButton.style('line-height', '20px'); // Better vertical alignment
    expandedCloseButton.mousePressed(() => closeExpandedView());
        
    // 50/50 split for navigation - ensure these are created BEFORE the image
    // so they'll be underneath the image in the DOM (fixing the click issue)
    let leftHalf = createDiv('');
    leftHalf.parent(expandedOverlay);
    leftHalf.style('position', 'absolute');
    leftHalf.style('top', '0');
    leftHalf.style('left', '0');
    leftHalf.style('width', '50%');
    leftHalf.style('height', '100%');
    leftHalf.id('leftHalf');
    
    let rightHalf = createDiv('');
    rightHalf.parent(expandedOverlay);
    rightHalf.style('position', 'absolute');
    rightHalf.style('top', '0');
    rightHalf.style('left', '50%');
    rightHalf.style('width', '50%');
    rightHalf.style('height', '100%');
    rightHalf.id('rightHalf');
  }

  updateNavigationControls(index);

  // Remove any old image
  if (expandedImage) {
    expandedImage.remove();
    expandedImage = null;
  }

  // Fade in the overlay itself
  anime({
    targets: expandedOverlay.elt,
    opacity: 1,
    duration: 800,
    easing: 'cubicBezier(.22,1,.36,1)'
  });

  // Create the new image or video
  let original = expandedItems[index];
  let tagName = original.tagName.toLowerCase();
  
  if (tagName === 'img') {
    expandedImage = createImg(original.src, '');
  } else {
    expandedImage = createVideo(original.src);
    expandedImage.attribute('playsinline', '');
    expandedImage.attribute('muted', '');
    expandedImage.attribute('autoplay', '');
    expandedImage.attribute('loop', '');
  }

  // Absolutely position in the center
  expandedImage.parent(expandedOverlay);
  expandedImage.id('expandedImage'); // Add an ID for CSS targeting
  expandedImage.style('position', 'absolute');
  expandedImage.style('top', '50%');
  expandedImage.style('left', '50%');
  expandedImage.style('transform', 'translate(-50%, -50%) scale(0.95)');
  expandedImage.style('opacity', '0');
  expandedImage.style('max-width', '80%');
  expandedImage.style('max-height', '80%');
  expandedImage.style('object-fit', 'contain');
  expandedImage.style('z-index', '10000'); // Keep this above the navigation divs
  expandedImage.style('pointer-events', 'none'); // CRITICAL: Make image not capture clicks
  
  // Animate the new image/video in (with scale)
  anime({
    targets: expandedImage.elt,
    opacity: 1,
    scale: 1,
    duration: 800,
    easing: 'cubicBezier(.22,1,.36,1)',
    complete: () => {
      // Reset transform so leftover transitions won't conflict
      expandedImage.style('transform', 'translate(-50%, -50%)');
    }
  });
}


function updateNavigationControls(index) {
  const leftHalf = document.getElementById('leftHalf');
  const rightHalf = document.getElementById('rightHalf');
  
  if (!leftHalf || !rightHalf) return;
  
  // Clear previous event listeners
  leftHalf.onmousemove = null;
  rightHalf.onmousemove = null;
  leftHalf.onmouseleave = null;
  rightHalf.onmouseleave = null;
  leftHalf.onclick = null;
  rightHalf.onclick = null;
  
  // Get cursor elements
  const leftCursor = document.getElementById('left-cursor');
  const rightCursor = document.getElementById('right-cursor');
  
  // Set up left half (previous)
  if (index > 0) {
    // Update cursor on mouse movement
    leftHalf.onmousemove = (e) => {
      if (leftCursor) {
        leftCursor.style.display = 'block';
        leftCursor.style.left = e.clientX + 'px';
        leftCursor.style.top = e.clientY + 'px';
      }
      // Hide right cursor if visible
      if (rightCursor) rightCursor.style.display = 'none';
    };
    
    leftHalf.onmouseleave = () => {
      if (leftCursor) leftCursor.style.display = 'none';
    };
    
    leftHalf.onclick = () => showPrevImage();
    leftHalf.style.cursor = 'none'; // Hide default cursor
  } else {
    // First image - no previous
    leftHalf.style.cursor = 'auto';
  }
  
  // Set up right half (next)
  if (index < expandedItems.length - 1) {
    // Next image available
    rightHalf.onmousemove = (e) => {
      if (rightCursor) {
        rightCursor.style.display = 'block';
        rightCursor.style.left = e.clientX + 'px';
        rightCursor.style.top = e.clientY + 'px';
      }
      // Hide left cursor if visible
      if (leftCursor) leftCursor.style.display = 'none';
    };
    
    rightHalf.onmouseleave = () => {
      if (rightCursor) rightCursor.style.display = 'none';
    };
    
    rightHalf.onclick = () => showNextImage();
    rightHalf.style.cursor = 'none'; // Hide default cursor
  } else if (index > 0) {
    // Last image, but can go back
    rightHalf.onmousemove = (e) => {
      if (leftCursor) {
        leftCursor.style.display = 'block';
        leftCursor.style.left = e.clientX + 'px';
        leftCursor.style.top = e.clientY + 'px';
      }
      // Hide right cursor if visible
      if (rightCursor) rightCursor.style.display = 'none';
    };
    
    rightHalf.onmouseleave = () => {
      if (leftCursor) leftCursor.style.display = 'none';
    };
    
    rightHalf.onclick = () => showPrevImage();
    rightHalf.style.cursor = 'none';
  } else {
    // Only one image
    rightHalf.style.cursor = 'auto';
  }
}



function showNextImage() {
  if (currentExpandedIndex < expandedItems.length - 1) {
    currentExpandedIndex++;
    transitionExpandedImage(currentExpandedIndex, 'next');
  }
}

function showPrevImage() {
  if (currentExpandedIndex > 0) {
    currentExpandedIndex--;
    transitionExpandedImage(currentExpandedIndex, 'prev');
  }
}

function transitionExpandedImage(index, direction) {
  if (!expandedImage) {
    showExpandedOverlay(index);
    return;
  }

  // Update navigation controls for the new index
  updateNavigationControls(index);

  // oldImage is the image currently showing
  let oldImage = expandedImage;

  // Prepare the new image
  let original = expandedItems[index];
  let tagName = original.tagName.toLowerCase();
  
  if (tagName === 'img') {
    expandedImage = createImg(original.src, '');
  } else {
    expandedImage = createVideo(original.src);
    expandedImage.attribute('playsinline', '');
    expandedImage.attribute('muted', '');
    expandedImage.attribute('autoplay', '');
    expandedImage.attribute('loop', '');
  }

  // Absolutely position the new content at center, offset horizontally
  expandedImage.parent(expandedOverlay);
  expandedImage.id('expandedImage');
  expandedImage.style('position', 'absolute');
  expandedImage.style('top', '50%');
  expandedImage.style('left', '50%');
  expandedImage.style('z-index', '10000'); 
  expandedImage.style('pointer-events', 'none'); // CRITICAL: Make image not capture clicks
  
  // Slide from the right if next, or from the left if prev (no scale)
  let offsetX = (direction === 'next') ? 30 : -30;
  // Set initial transform with offsetX
  expandedImage.style('transform', `translate(-50%, -50%) translateX(${offsetX}px)`);
  expandedImage.style('opacity', '0');
  expandedImage.style('max-width', '80%');
  expandedImage.style('max-height', '80%');
  expandedImage.style('object-fit', 'contain');

  // Animate old content out
  anime({
    targets: oldImage.elt,
    opacity: 0,
    translateX: (direction === 'next') ? -30 : 30,
    duration: 800,
    easing: 'cubicBezier(1,0,0,1)',
    complete: () => oldImage.remove()
  });

  // Animate new content in
  anime({
    targets: expandedImage.elt,
    opacity: 1,
    translateX: 0,
    duration: 1000,
    easing: 'cubicBezier(1,0,0,1)',
    complete: () => {
      // Reset transform to only the centering translation
      expandedImage.style('transform', 'translate(-50%, -50%)');
    }
  });
}

function closeExpandedView() {
  if (!expandedOverlay) return;
  
  console.log("Close button clicked");
  
  // Immediately hide custom cursors and remove event listeners from halves
  const leftCursor = document.getElementById('left-cursor');
  const rightCursor = document.getElementById('right-cursor');
  const leftHalf = document.getElementById('leftHalf');
  const rightHalf = document.getElementById('rightHalf');
  
  // Remove all event listeners that could trigger cursor updates
  if (leftHalf) {
    leftHalf.onmousemove = null;
    leftHalf.onmouseleave = null;
    leftHalf.onclick = null;
    leftHalf.style.cursor = 'auto';
  }
  
  if (rightHalf) {
    rightHalf.onmousemove = null;
    rightHalf.onmouseleave = null;
    rightHalf.onclick = null;
    rightHalf.style.cursor = 'auto';
  }
  
  // Immediately hide cursors
  if (leftCursor) leftCursor.style.display = 'none';
  if (rightCursor) rightCursor.style.display = 'none';
  
  // Add a document mousemove listener to ensure cursor stays hidden
  // Remove it after animation completes
  const clearCursors = (e) => {
    if (leftCursor) leftCursor.style.display = 'none';
    if (rightCursor) rightCursor.style.display = 'none';
  };
  
  document.addEventListener('mousemove', clearCursors);
  
  // Fade out overlay
  anime({
    targets: expandedOverlay.elt,
    opacity: 0,
    duration: 900,
    easing: 'cubicBezier(.22,1,.36,1)',
    complete: () => {
      // Remove the document mousemove listener
      document.removeEventListener('mousemove', clearCursors);
      
      // Completely remove the overlay elements rather than just hiding them
      if (expandedImage) {
        expandedImage.remove();
        expandedImage = null;
      }
      
      // Remove the overlay itself
      expandedOverlay.remove();
      expandedOverlay = null;
      
      // Reset the expanded index
      currentExpandedIndex = -1;
    }
  });
}



























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

  createCursorElements();
//  setupBackButton(); // Add this line at the end

}

function initializeBackButtonHover() {
  // Create the back text element and set up hover animations
  window.backHomeText = setupBackButton();
}



function createCursorElements() {
  // Create container for custom cursors
  const cursorContainer = createDiv('');
  cursorContainer.id('cursor-container');
  cursorContainer.style('position', 'fixed');
  cursorContainer.style('top', '0');
  cursorContainer.style('left', '0');
  cursorContainer.style('pointer-events', 'none'); // Important: don't capture clicks
  cursorContainer.style('z-index', '99999'); // Above everything
  
  // Left arrow cursor
  const leftCursor = createDiv('←');
  leftCursor.parent(cursorContainer);
  leftCursor.id('left-cursor');
  leftCursor.class('custom-cursor');
  leftCursor.style('display', 'none');
  leftCursor.style('position', 'fixed');
  leftCursor.style('font-family', 'Geist UltraLight, sans-serif');
  leftCursor.style('font-size', '28px');
  leftCursor.style('color', 'white');
  leftCursor.style('text-shadow', '0 0 2px rgba(0,0,0,0.5)');
  leftCursor.style('transform', 'translate(-50%, -50%)');
  leftCursor.style('pointer-events', 'none');
  
  // Right arrow cursor
  const rightCursor = createDiv('→');
  rightCursor.parent(cursorContainer);
  rightCursor.id('right-cursor');
  rightCursor.class('custom-cursor');
  rightCursor.style('display', 'none');
  rightCursor.style('position', 'fixed');
  rightCursor.style('font-family', 'Geist UltraLight, sans-serif');
  rightCursor.style('font-size', '28px');
  rightCursor.style('color', 'white');
  rightCursor.style('text-shadow', '0 0 2px rgba(0,0,0,0.5)');
  rightCursor.style('transform', 'translate(-50%, -50%)');
  rightCursor.style('pointer-events', 'none');
}

function setupBackButton() {
  // Create arrow
  backButton = createDiv('←');
  backButton.id('backButton');
  backButton.style('position', 'absolute');
  backButton.style('font-family', 'Geist UltraLight, sans-serif');
  backButton.style('cursor', 'pointer');
  backButton.style('opacity', '0.2');

  // Create text
  backHomeText = createDiv('Back home');
  backHomeText.id('backHomeText');
  backHomeText.style('position', 'absolute');
  backHomeText.style('transform', 'translateX(-120px)');

  backHomeText.style('font-family', 'Geist UltraLight, sans-serif');
  backHomeText.style('opacity', '0'); // start hidden


  backButton.mouseOver(() => {
    anime({
      targets: backButton.elt,
      opacity: 1,
      duration: 400,
      easing: 'easeOutCubic'
    });
  });

  backButton.mouseOut(() => {
    anime({
      targets: backButton.elt,
      opacity: 0.2, // instead of 0.2
      duration: 300,
      easing: 'easeOutCubic'
    });
  });
    

  // Add arrow hover to show/hide text, if you like
  backButton.mouseOver(() => {
    anime({
      targets: backHomeText.elt,
      translateX: -118,  // <-- Adjust this value to change how far the text shifts on hover
      opacity: 0.2,
      duration: 400,
      easing: 'cubicBezier(1,0,0,1)',
    });
  });
  backButton.mouseOut(() => {
    anime({
      targets: backHomeText.elt,
      translateX: -130,  // <-- Adjust this value for mouse-out behavior
      opacity: 0,
      duration: 400,
      easing: 'cubicBezier(1,0,0,1)',
    });
  });
    // Click closes the gallery
  backButton.mousePressed(() => {
    closeGallery();
  });

  // Finally, position them
  updateBackButtonPosition();
}

function updateBackButtonPosition() {
  if (!backButton || !backHomeText) return;

  // Make sure they scale with your current text size
  backButton.style('z-index', '1000');
backHomeText.style('z-index', '1000');
backButton.style('opacity', '0.2');
backButton.style('padding', '20px');
backButton.style('margin', '-20px');



  const fontSize = TEXTSCALE * scaleFactor;
  backButton.style('font-size', fontSize + 'px');
  backHomeText.style('font-size', fontSize + 'px');

  // Decide your X offsets
  // For example, place the text near the right edge:
  const textX = rightPanelX + rightPanelW; 
  // Now place it EXACTLY at phraseY:
  backHomeText.position(textX, phraseY);

  // Put the arrow just to the left of that text, at the same Y
  const arrowX = textX - (fontSize * 2); // adjust as needed
  backButton.position(arrowX, phraseY);
}

function updateBackTextPosition(textElement, margin) {
  if (!textElement || !backButton) return;
  
  const fontSize = TEXTSCALE * scaleFactor;
  const buttonSize = fontSize * 2.4;
  
  // Position the text to the right of the arrow
  textElement.position(
    rightPanelX + rightPanelW - buttonSize + (fontSize * 1.2), // Position after the arrow
    rightPanelY + (fontSize * 0.8) // Align vertically with arrow
  );
}

function showBackButton() {
  if (!backButton) {
    setupBackButton();
  }
  
  // Animate button appearance
  anime({
    targets: backButton.elt,
    opacity: 1,
    translateX: 0,
    duration: 600,
    easing: 'easeOutQuint'
  });
}
function hideBackButton() {
  if (backButton) {
    anime({
      targets: backButton.elt,
      opacity: 0,
      translateX: +20,
      duration: 400,
      easing: 'easeInQuint'
    });
    
    // Also hide the text if it exists
    if (window.backHomeText) {
      anime({
        targets: window.backHomeText.elt,
        opacity: 0,
        duration: 300,
        easing: 'easeInQuint'
      });
    }
  }
}

function closeGallery() {
  // Only proceed if we're in gallery mode
  if (leftPanelMode !== "htmlGallery") return;
  
  console.log("Closing gallery, returning to physics simulation");
  
  // Hide the back button first
  hideBackButton();
  
  // Fade out the HTML gallery
  anime({
    targets: htmlGallery.elt,
    opacity: 0,
    scale: 0.98,
    duration: 700,
    easing: 'easeInOutQuint'
  });
  
  // Fade out the description
  anime({
    targets: htmlDescription.elt,
    opacity: 0,
    duration: 400,
    easing: 'easeInOutQuint'
  });
  
  // Fade out the physics cover (reveal physics simulation)
  let coverObj = { alpha: physicsCoverAlpha };
  anime({
    targets: coverObj,
    alpha: 255,
    duration: 700,
    easing: 'easeInOutQuint',
    update: function() {
      physicsCoverAlpha = coverObj.alpha;
    },
      complete: function() {
      // Reset state after animations complete
      leftPanelMode = "physics";
      activeProject = null;
      
      // Clear gallery content
      document.getElementById('galleryContent').innerHTML = "";
      
      // Reset scroll position
      targetScrollY = 0;
      currentScrollY = 0;
      htmlGallery.elt.scrollTop = 0;
      
      // Restore physics state
      centerArrowBall.setTargetToMouse();
    }
  });
}



function drawDesktop() {
  noStroke();
  
  push();
  // Draw physics simulation background if in physics mode.
  if (!galleryTransitionActive && leftPanelMode === "physics") {
    push();
    fill(255, 255, 0, physicsAlpha);
    rect(leftPanelX, leftPanelY, leftPanelW, leftPanelH);
    pop();
  }
  
  pop();
  
  // Draw right panel (description panel on canvas)
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
  
  // Draw the project index on canvas.
  drawProjectIndex();
  
  // NEW: If a project is open (HTML gallery mode), cover the left panel.
  if (leftPanelMode === "htmlGallery") {
    updateScroll();  // Add this line

    push();
    noStroke();
    // Draw a rectangle in the background color with an alpha that fades in.
    fill(backgroundColor[0], physicsCoverAlpha);
    rect(leftPanelX, leftPanelY, leftPanelW, leftPanelH);
    pop();
  }
}

//
// NEW: HTML Gallery Loader using Anime.js

function loadProjectHTML(project) {
  htmlGallery.style('pointer-events', 'auto');
  
  // First, reset scroll variables but don't apply them yet
  const newTargetScrollY = window.innerHeight * 3;
  
  anime({
    targets: htmlGallery.elt,
    opacity: 0,
    scale: 0.98,
    duration: 700,
    easing: 'easeInOutQuint',
    complete: function() {
      // Reset position before content change (while invisible)
      htmlGallery.elt.style.transform = 'translateY(-20px)';
      
      // Build content
      let content = '';
      project.media.forEach((item) => {
        if (item.type === "image") {
          content += `
            <img 
              src="${item.src}" 
              class="gallery-item" 
              style="
                width: 100%;
                max-width: 100%;
                height: auto;
                margin-bottom: 20px;
                display: block;
                object-fit: contain;
                opacity: 1;
                transform-origin: center;
              " 
              loading="lazy"
            >`;
        } else if (item.type === "video") {
          content += `
            <video 
              src="${item.src}" 
              class="gallery-item" 
              style="
                width: 100%;
                max-width: 100%;
                height: auto;
                margin-bottom: 20px;
                display: block;
                object-fit: contain;
                opacity: 1;
                transform-origin: center;
              " 
              playsinline 
              loop 
              muted 
              autoplay
            ></video>`;
        }
      });
      
      // Update content and scroll position while opacity is 0
      document.getElementById('galleryContent').innerHTML = content;
      targetScrollY = newTargetScrollY;
      currentScrollY = newTargetScrollY;
      scrollVelocity = 0;
      htmlGallery.elt.scrollTop = newTargetScrollY;
      
      // Add hover effects after content is in DOM
      const items = document.getElementsByClassName('gallery-item');
      expandedItems = Array.from(items);
      expandedItems.forEach((item, index) => {
        item.addEventListener('click', () => {
          openExpandedView(index);
        });
      });
            
      let currentHoveredItem = null;
    
      // Function to update all items based on current hovered item
      const updateItemStates = (hoveredItem) => {
        Array.from(items).forEach(item => {
          if (item === hoveredItem) {
            // Expand the hovered item
            anime({
              targets: item,
              scale: 1,
              opacity: 1,
              duration: 400,
              easing: 'cubicBezier(1,0,0,1)',
            });
          } else {
            // Shrink all other items
            anime({
              targets: item,
              scale: 0.98,
              opacity: 0.8,
              duration: 400,
              easing: 'cubicBezier(1,0,0,1)',
            });
          }
        });
      };
      
      // Add mouse enter/leave handlers to each item
      Array.from(items).forEach(item => {
        item.addEventListener('mouseenter', () => {
          currentHoveredItem = item;
          updateItemStates(item);
        });
        
        item.addEventListener('mouseleave', () => {
          // Only reset if we're leaving the currently hovered item
          if (item === currentHoveredItem) {
            // Small delay to check if we entered another item
            setTimeout(() => {
              if (currentHoveredItem === item) {
                currentHoveredItem = null;
                // Reset all items 
                anime({
                  targets: '.gallery-item',
                  scale: 1,
                  opacity: 1,
                  duration: 200,
                  easing: 'easeOutQuint'
                });
              }
            }, 50);
          }
        });
      });
      
      // Also add a mouse leave handler to the entire gallery container
      document.getElementById('galleryContent').addEventListener('mouseleave', () => {
        currentHoveredItem = null;
        // Reset all items
        anime({
          targets: '.gallery-item',
          scale: 1,
          opacity: 1,
          duration: 500,
          easing: 'easeInOutQuint'
        });
      });
      
      // Fade back in with upward movement
      anime({
        targets: htmlGallery.elt,
        scale: 1,
        opacity: 1,
        translateY: '0px',
        duration: 1400,
        easing: 'cubicBezier(0,0,0,1)',
      });

      // Update description
      anime({
        targets: htmlDescription.elt,
        opacity: 0,
        duration: 400,
        easing: 'easeInOutQuint',
        complete: function() {
          htmlDescription.html(project.description);
          htmlDescription.style('font-size', (TEXTSCALE * scaleFactor) + 'px');
          anime({
            targets: htmlDescription.elt,
            opacity: 1,
            duration: 500,
            easing: 'easeInOutQuint'
          });
        }
      });

      // Animate the physics cover
      let coverObj = { alpha: physicsCoverAlpha };
      anime({
        targets: coverObj,
        alpha: 255,
        duration: 700,
        easing: 'easeInOutQuint',
        update: function() {
          physicsCoverAlpha = coverObj.alpha;
        }
      });
            
      // Show the back button with a slight delay
      setTimeout(() => {
        if (!backButton) {
          setupBackButton();
        }
        showBackButton();
      }, 400);
          }
  });
}




  function mousePressed() {
    // Check if a project index item was clicked.
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
        // CHANGE: Set activeProject immediately
        activeProject = proj;
        // Update project state variables
        projectDescriptionFadeStartTime = millis() / 1000;
        
        // Set the left panel mode immediately to mark it as selected
        leftPanelMode = "htmlGallery";
        
        // Start transition to cover physics
        
        
        // Then continue with loading the HTML gallery
        loadProjectHTML(proj);
        return;
      }
    }
    
  // Existing behavior for letter balls and other interactions.
  if (MOBILE_MODE) {
    mousePressedMobile();
    return;
  }
  if (isFadingBalls) return;
  if (!isInsideInteractiveArea(mouseX - ballSpawnOffset.x, mouseY - ballSpawnOffset.y)) return;
  
  if (phraseIndex < phrase.length) {
    let c = phrase[phraseIndex];
    let upperC = c.toUpperCase();
    createLetterBallDesktop(
      mouseX - ballSpawnOffset.x,
      mouseY - ballSpawnOffset.y,
      upperC
    );
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
      let eased = easeInOutQuint(t);
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
