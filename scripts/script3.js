
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
    geom.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array([-1,-1,0, 1,-1,0, 1,1,0, -1,-1, 0, 1, 1, 0, -1,1,0 ]), 3 ) );
    geom.setAttribute( 'uv', new THREE.BufferAttribute( new Float32Array([ 0,1, 1,1, 1,0, 0,1, 1,0, 0,0 ]), 2 ) );
    this.scene.add( new THREE.Mesh( geom, imageProcessingMaterial ) );
}

function IVprocess ( imageProcessing, renderer )
{
    renderer.setRenderTarget( imageProcessing.rtt );
    renderer.render ( imageProcessing.scene, imageProcessing.orthoCamera ); 	
    renderer.setRenderTarget( null );
};

let camera, controls, scene, renderer, container, planSource, planProcessed;

// GUI
let gui;


//Materials
let imgTransMat, imgArithMat, gaussianMat, knnMat;
//Processing
let imgTransProcessing, imgArithProcessing, gaussianProcessing, knnProcessing;

let height, width, texture, image, webcam, video, videoTexture, webcamTexture;

//API
let scaleAPI, combinationAPI, gaussianAPI, knnAPI;

let type = "image"
let sourceImage = "image.png";
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

    //API
    scaleAPI = {
        scaleFactor: 1.0,
        bilinearFiltering: true
    };

    gaussianAPI = {
        ksize: 3,
        sigma: 1.0
    };

    knnAPI = {
        ksize: 3,
        percent: 0.0
    };

	console.log(type);
	if (type == "image"){ //Image
		let loader = new THREE.TextureLoader();
		loader.load( sourceImage,  function (newtexture) {
			image = newtexture;
			height = image.image.height;
			width = image.image.width;
			texture = image;

			continueLoading();
		});
	} else if(type == "video"){ //Video
		video = document.createElement('video');
		video.src = sourceVideo;
		video.load();
		video.muted = true;
		video.loop = true;
		video.play();

		video.onloadeddata = function (){ 
			videoTexture = new THREE.VideoTexture( video );
			videoTexture.minFilter = THREE.NearestFilter;
			videoTexture.magFilter = THREE.NearestFilter;
			videoTexture.generateMipmaps = false; 
			videoTexture.format = THREE.RGBFormat;

			height = video.videoHeight;
			width = video.videoWidth;
			texture = videoTexture;
			continueLoading();
		}
	} else { //Webcam
		webcam = document.createElement('video');
		if ( navigator.mediaDevices && navigator.mediaDevices.getUserMedia ) {
			const constraints = { video: { width: 1920, height: 1080, facingMode: 'user' } };
			navigator.mediaDevices.getUserMedia( constraints ).then( function ( stream ) {
				webcam.srcObject = stream;
				webcam.play();
			})
		}

		webcam.onloadeddata = function (){ 
            webcamTexture = new THREE.VideoTexture( webcam );
            webcamTexture.minFilter = THREE.NearestFilter;
            webcamTexture.magFilter = THREE.NearestFilter;
            webcamTexture.generateMipmaps = false; 
            webcamTexture.format = THREE.RGBFormat;

			height = webcam.videoHeight;
			width = webcam.videoWidth;
			texture = webcamTexture;
			continueLoading();
		}
	}
};

function continueLoading(){
    var geometry = new THREE.PlaneGeometry( 1, height/width );
    planProcessed = new THREE.Mesh( geometry, getMaterial());
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

    addGUI();
    javascript:(function(){var script=document.createElement('script');script.onload=function(){var stats=new Stats();document.body.appendChild(stats.dom);requestAnimationFrame(function loop(){stats.update();requestAnimationFrame(loop)});};script.src='//mrdoob.github.io/stats.js/build/stats.min.js';document.head.appendChild(script);})()
    window.addEventListener( 'resize', onWindowResize, false );
}

function gaussianMatrix(ksize, sigma){

    let GKernel = new Array(ksize);

    for (let i = 0; i < GKernel.length; i++) {
        GKernel[i] = new Array(ksize);
    }

    let r;
    let s = 2.0 * sigma * sigma;
    let val = (ksize - 1)/2;
 
    // sum is for normalization
    let sum = 0.0;
 
    // generating 5x5 kernel
    for (let x = -val; x <= val; x++) {
        for (let y = -val; y <= val; y++) {
            r = Math.sqrt(x * x + y * y);
            GKernel[x + val][y + val] = (Math.exp(-(r * r) / s)) / (Math.PI * s);
            sum += GKernel[x + val][y + val];
        }
    }

    let mat = Array(225).fill(0.0);

    // normalising the Kernels
    for (let i = 0; i < ksize; ++i)
        for (let j = 0; j < ksize; ++j)
            mat[i*ksize+j] = GKernel[i][j] / sum;
    return mat;
}

function getGausVector(matGauss, ksize){
    let Vec = new Array(ksize);
    for (let i = 0; i < ksize; i++) {
        let tmp = 0;
        for (let j = 0; j < ksize; j++) {
            tmp += matGauss[i*ksize + j];
        }
        Vec[i] = tmp;
    } 
    return Vec;
}

function getMaterial(){
	let matGauss = gaussianMatrix(3, 1);

	gaussianMat = new THREE.ShaderMaterial({
		uniforms: {
			image: {type: 't', value: texture},
			mat: {type: 'f', value: matGauss},
			ksize: {type: 'i', value: 3}
		},
		vertexShader: document.getElementById('vertShader').text,
		fragmentShader: document.getElementById('convMatFrag').text,
	});

	gaussianProcessing = new IVimageProcessing ( height, width, gaussianMat );

	knnMat = new THREE.ShaderMaterial({
        uniforms: {
            image: {type: 't', value: texture},
            ksize: {type: 'i', value: 3},
            percent: {type: 'i', value: 0}
        },
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('knnMatFrag').text,
    });

    knnProcessing = new IVimageProcessing ( height, width, knnMat );

	imgArithMat = new THREE.ShaderMaterial({
        uniforms: {
            source1: {type: 't', value: knnProcessing.rtt.texture},
            source2: {type: 't', value: gaussianProcessing.rtt.texture}
        },
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('imgArithMatFrag').text,
    });

	imgArithProcessing = new IVimageProcessing ( height, width, imgArithMat );

	imgTransMat = new THREE.ShaderMaterial({
        uniforms: {
            image: { type: 't', value: imgArithProcessing.rtt.texture },
            scaleFactor: { type: 'f', value: 1.0 },
            bilinearFiltering: { type: 'b', value: true }
        },
        vertexShader: document.getElementById('vertShader').text,
        fragmentShader: document.getElementById('imgTransMatFrag').text,
    });

	imgTransProcessing = new IVimageProcessing ( height, width, imgTransMat );

    return new THREE.MeshBasicMaterial( { map: imgTransProcessing.rtt.texture, side : THREE.DoubleSide } );
}

function changeSource(value){
    if (value == "image"){
        imgArithMat.uniforms.source2.value = image
    } else if (value == "video"){
        imgArithMat.uniforms.source2.value = videoTexture
    } else {
        imgArithMat.uniforms.source2.value = webcamTexture
    }
}

function addGUI(){
    gui = new GUI( { title: "Image Transformation" } );
    let folder = gui.addFolder("Scaling");
    folder.add( scaleAPI, 'scaleFactor', 0.2, 5, 0.2)
        .name( 'scaleFactor' )
        .onChange( function (value) {
            if ((value*10)%2 != 0) scaleAPI.scaleFactor = value - 0.1;
            imgTransMat.uniforms.scaleFactor.value = scaleAPI.scaleFactor;
        } );
    folder.add( scaleAPI, 'bilinearFiltering')
        .name( 'bilinearFiltering' )
        .onChange( function () {
            imgTransMat.uniforms.bilinearFiltering.value = scaleAPI.bilinearFiltering;
        } );

    folder = gui.addFolder("Gaussian Filter");
    folder.add( gaussianAPI, 'ksize', 3, 15, 2)
        .name( 'ksize' )
        .onChange( function (value) {
            if (value%2 == 0) gaussianAPI.ksize = value - 1;
            gaussianMat.uniforms.ksize.value = gaussianAPI.ksize;
            gaussianMat.uniforms.mat.value = gaussianMatrix(gaussianAPI.ksize, gaussianAPI.sigma);
        } );
    folder.add( gaussianAPI, 'sigma', 0.01, 5.0, 0.01)
        .name( 'sigma' )
        .onChange( function (value) {
            gaussianMat.uniforms.mat.value = gaussianMatrix(gaussianAPI.ksize, gaussianAPI.sigma);
        } );

    folder = gui.addFolder("K-nearest neighbor");
    folder.add( knnAPI, 'ksize', 3, 15, 2)
        .name( 'ksize' )
        .onChange( function (value) {
            if (value%2 == 0) knnAPI.ksize = value - 1;
            knnMat.uniforms.ksize.value = knnAPI.ksize;
        });
    folder.add( knnAPI, 'percent', 0, 100, 1)
        .name( 'percent' )
        .onChange( function () {
            knnMat.uniforms.percent.value = knnAPI.percent;
        });
}

function render () {
    renderer.clear();

    if (typeof imgTransProcessing !== 'undefined') 
        IVprocess ( imgTransProcessing, renderer );
	if (typeof imgArithProcessing !== 'undefined') 
        IVprocess ( imgArithProcessing, renderer );
	if (typeof gaussianProcessing !== 'undefined') 
        IVprocess ( gaussianProcessing, renderer );
	if (typeof knnProcessing !== 'undefined') 
        IVprocess ( knnProcessing, renderer );
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
