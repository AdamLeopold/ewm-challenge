// Hong Kong daylight and weather for the 3D city: starts once the city scene is ready.
import {startEnvironment} from './environment-controller.js?v=environment-2';

while (!window.preview?.ready) await new Promise(done => setTimeout(done, 200));
const {scene, camera, renderer, controls, rendering} = window.preview;
const hemisphere = scene.children.find(o => o.isHemisphereLight);
const sunLight = scene.children.find(o => o.isDirectionalLight && o.castShadow);
if (hemisphere && sunLight) startEnvironment({scene, camera, renderer, controls, sunLight, hemisphere, rendering});
