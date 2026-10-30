// The part of three.js the decorative canvases use (the landing field, the
// catalog graph and the sign-in sphere; decision 057). Islands import three
// only through this module, after
// load and idle, so a class missing here is a type error, not a runtime one.
//
// three ships as two files with all of it inside (~750 KB minified, ~156 KB
// brotli). In development this module re-exports them as they are; the
// production build (`scripts/build.ts`, `bundleThree`) bundles it with
// esbuild instead, keeping only these exports: one file of ~535 KB minified,
// ~110 KB brotli, published at a content hash.
export {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  LinearSRGBColorSpace,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three'
