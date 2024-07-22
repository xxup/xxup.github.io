addEventListener("load",function(e){
document.querySelector("#test").innerHTML="webVisual";
});

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



/**
function setup(){
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB,360,100,100);
  noLoop();
}
function draw(){
  let startColor=color(1,100,100);
  let endColor=color(359,100,100);
  for(let y=0; y<height; y++){
  let interColor=map(y,0,height,0,1);
  let c=lerpColor(startColor,endColor,interColor);
 stroke(c);
 line(0,y,height,y);
 }
}
*/