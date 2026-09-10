function setup(){
  createCanvas(windowWidth, windowHeight);
  gradientColor(20);
}

function gradientColor(r){
  noStroke();
colorMode(HSB,width,height,100);
  for(let x=0; x<width; x+=r){
   for(let y=0; y<height; y+=r){
  fill(x,height-y,100);
  rect(x,y,r,r);
    }
  }
}