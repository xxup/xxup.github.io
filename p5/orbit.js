let t = 0;

function setup() {
  createCanvas(windowWidth, windowHeight);
}

function draw() {
  background(10, 10);
  translate(width / 2, height / 2);
  for (let i = 0; i < 20; i++) {
    let angle = t + i * 0.3;
    let r = 50 + i * 15;
    fill(255 - i * 10, 100 + i * 5, 200);
    noStroke();
    ellipse(cos(angle) * r, sin(angle) * r, 20, 20);
  }
  t += 0.02;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}