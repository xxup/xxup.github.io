let str = "randomArt可视化创意编程";
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB,360,100,100,100);
}
function draw() {
  background(0,0,0,5);
  fill(random(360),100,random(100),100);
  let n = floor(random(str.length));
  let str_trim = str.charAt((str.length-1)-frameCount%str.length);
  textSize(frameCount*10%250);
  textAlign(CENTER,CENTER);
text(str_trim,random(width),random(height));
}

/*
function setup() {
  createCanvas(windowWidth, windowHeight);
  background(255);
  noFill();
  stroke(255);
  frameRate(30);
  colorMode(HSB, 360, 100, 100, 360);
}
function draw() {
  fill(270, 0, 100, 50);
  noStroke();
  rect(0, 0, width, height);
  noFill();
  strokeWeight(1.5);
  for (let i = 0; i <= width / 2; i++) {
    const hue = map(i, 0, width / 2, 0, 360);
    stroke(hue, 100, 100, 128);
    beginShape();
    for (let x = -10; x < width + 21; x += 10) {
      const n = noise(x * 0.001, frameCount * 0.008, i * 0.02);
      const y = map(n, 0, 1, 0, height);
      curveVertex(x, y);
    }
    endShape();
  }
}
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
*/