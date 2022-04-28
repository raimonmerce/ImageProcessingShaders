
import * as THREE from 'https://cdn.skypack.dev/three@0.136.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'https://cdn.skypack.dev/three@0.136.0/examples/jsm/libs/lil-gui.module.min';

function IVimageProcessing ( height, width, imageProcessingMaterial )
{
    this.height = height;
    this.width = width;

    //3 rtt setup
    this.scene = new THREE.Scene();
    this.orthoCamera = new THREE.OrthographicCamera(-1,1,1,-1,1/Math.pow( 2, 53 ),1 );

    //4 create a target texture
    var options = {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat,
        //            type:THREE.FloatType
        type:THREE.UnsignedByteType
    };
    this.rtt = new THREE.WebGLRenderTarget( width, height, options);

    var geom = new THREE.BufferGeometry();
    geom.addAttribute( 'position', new THREE.BufferAttribute( new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,-1, 0, 1, 1, 0, -1,1,0 ]), 3 ) );
    geom.addAttribute( 'uv', new THREE.BufferAttribute( new Float32Array([ 0,1, 1,1, 1,0, 0,1, 1,0, 0,0 ]), 2 ) );
    this.scene.add( new THREE.Mesh( geom, imageProcessingMaterial ) );
}

function IVprocess ( imageProcessing, renderer )
{
    renderer.setRenderTarget( imageProcessing.rtt );
    renderer.render ( imageProcessing.scene, imageProcessing.orthoCamera ); 	
    renderer.setRenderTarget( null );
};

let camera, controls, scene, renderer, container, planSource, planProcessed;

// VIDEO AND THE ASSOCIATED TEXTURE
let imageProcessing, imageProcessingMaterial;

// GUI
let gui;


//Materials
let tmpMat;

let height, width, texture, image, webcam, video, videoTexture, webcamTexture;

let type = "image"
let sourceImage = "grenouille.jpg";
let sourceVideo = "video.mp4";

init();
animate();

function init () {
	let queryString = window.location.search;
	let urlParams = new URLSearchParams(queryString);
	let sourceURL = urlParams.get('sourceimage');
	if (sourceURL === null) console.log("You should add '?sourceimage=type' in the url");
	else {
		if (sourceURL == "video") type = "video";
		else if (sourceURL == "webcam") type = "webcam";
		else if (sourceURL != "image") console.log("sourceimage type is not correct");
		//image, video or webcam
	}

    container = document.createElement( 'div' );
    document.body.appendChild( container );

    scene = new THREE.Scene(); 

    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true } );
    renderer.autoClear = false;
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    renderer.shadowMap.enabled = false;

    container.appendChild( renderer.domElement );

    camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.001, 10 );
    camera.position.z = 0.7;
    controls = new OrbitControls( camera, renderer.domElement );
    controls.minDistance = 0.005;
    controls.maxDistance = 2.0;
    controls.enableRotate = true;
    controls.addEventListener( 'change', render );
    controls.update();

	console.log(type);
	if(type == "webcam" || type == "video"){
		video = document.createElement('video');
		if (type == "webcam"){
			if ( navigator.mediaDevices && navigator.mediaDevices.getUserMedia ) {
				const constraints = { video: { width: 1920, height: 1080, facingMode: 'user' } };
				navigator.mediaDevices.getUserMedia( constraints ).then( function ( stream ) {
					video.srcObject = stream;
					video.play();
				})
			}
		} else {
			video.src = sourceVideo;
			video.load();
			video.muted = true;
			video.loop = true;
		}

		video.onloadeddata = function () 
		{ 
			videoTexture = new THREE.VideoTexture( video );
			videoTexture.minFilter = THREE.NearestFilter;
			videoTexture.magFilter = THREE.NearestFilter;
			videoTexture.generateMipmaps = false; 
			videoTexture.format = THREE.RGBFormat;
            height = video.videoHeight;
            width = video.videoWidth;
            texture = videoTexture;
			continueLoading()
		}
		

	} else {
		let loader = new THREE.TextureLoader();
		loader.load( sourceImage,  function (newtexture) {
            height = newtexture.image.height;
            width = newtexture.image.width;
            texture = newtexture;
			continueLoading()
		}); 
	}
};

function continueLoading(){
    declareMaterials()
    var geometry = new THREE.PlaneGeometry( 1, height/width );
    let material = getMaterials(tmpMat);
    planProcessed = new THREE.Mesh( geometry, material );
	planProcessed.position.x = 0.5;
    planProcessed.receiveShadow = false;
    planProcessed.castShadow = false;
    scene.add( planProcessed );

    var materialProcessed = new THREE.MeshBasicMaterial( { map: texture, side : THREE.DoubleSide } );
    planSource = new THREE.Mesh( geometry, materialProcessed );
    planSource.position.x = -0.5;
    planSource.receiveShadow = false;
    planSource.castShadow = false;
    scene.add( planSource );

	if (type == "webcam" || type == "video"){
		video.play();
	}

    window.addEventListener( 'resize', onWindowResize, false );
}

function declareMaterials(){
    tmpMat = new THREE.ShaderMaterial({
        uniforms: {
            sizeDiv2: {type: 'i', value: 1},
            colorScaleR: {type: 'f', value: 1.0},
            colorScaleG: {type: 'f', value: 1.0},
            colorScaleB: {type: 'f', value: 1.0},
            invert: {type: 'b', value: false},
            image: {type: 't', value: texture},
            resolution: {type: '2f', value:  new THREE.Vector2( width, height ) }
        },
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('fragShader').text,
    });
}

function getMaterials(imageProcessingMaterial){
    imageProcessing = new IVimageProcessing ( height, width, imageProcessingMaterial );
    return new THREE.MeshBasicMaterial( { map: imageProcessing.rtt.texture, side : THREE.DoubleSide } );
}


function render () {
    renderer.clear();

    if (typeof imageProcessing !== 'undefined') 
        IVprocess ( imageProcessing, renderer );
    renderer.render( scene, camera );

}

function animate() {	
    requestAnimationFrame(animate);
    controls.update();
    render();
}

function onWindowResize () {
    camera.aspect = ( window.innerWidth / window.innerHeight);
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
    render();
}