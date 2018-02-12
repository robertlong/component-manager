const ComponentManager = require("../src");
const { mat4 } = require("gl-matrix");
const assert = require("assert");

function benchmark(description, fn) {
  const start = Date.now();
  fn();
  const elapsed = Date.now() - start;
  console.log(`${description} took ${elapsed}ms`);
}

const TransformComponentManagerSchema = {
  name: "transform",
  properties: [
    {
      name: "localMatrix",
      type: "Float32Array",
      length: 16,
      default: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
    },
    {
      name: "worldMatrix",
      type: "Float32Array",
      length: 16,
      default: [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]
    },
    {
      name: "parent",
      type: "Int32",
      default: -1
    },
    {
      name: "firstChild",
      type: "Int32",
      default: -1
    },
    {
      name: "nextSibling",
      type: "Int32",
      default: -1
    },
    {
      name: "prevSibling",
      type: "Int32",
      default: -1
    },
    {
      type: "Entity"
    }
  ]
};

class TransformComponentManager extends ComponentManager {
  constructor(initialSize) {
    super(TransformComponentManagerSchema, initialSize);
  }
}

const transformComponentManager = new TransformComponentManager(100001);

benchmark("add 100,000 entities", () =>{
  for (var i = 0; i < 100000; i++) {
    transformComponentManager.add(i);
  }
});

assert(transformComponentManager.count === 100001);
assert(transformComponentManager.instances[1].entity === 0);

benchmark("remove 100,000 entities", () =>{
  for (var i = 0; i < 100000; i++) {
    transformComponentManager.remove(i);
  }
});

assert(transformComponentManager.count === 1);

benchmark("set 100,000 localPositions", () =>{
  const localMatrices = transformComponentManager.properties.localMatrix;
  for (var i = 0; i < 100000; i++) {
    localMatrices[i].set([8.5, 2, 3], 12);
  }
});

assert(transformComponentManager.properties.localMatrix[42][12] === 8.5);
assert(transformComponentManager.properties.localMatrix[75][13] === 2);
assert(transformComponentManager.properties.localMatrix[3300][14] === 3);

benchmark("multiply 100,000 matrices", () =>{
  const localMatrices = transformComponentManager.properties.localMatrix;
  const multiply = mat4.multiply;
  const mat = mat4.create();
  mat4.fromTranslation(mat, new Float32Array([1, 2, 3]));

  for (var i = 0; i < 100000; i++) {
    multiply(localMatrices[i], localMatrices[i], mat);
  }
});

assert(transformComponentManager.properties.localMatrix[42][12] === 9.5);
assert(transformComponentManager.properties.localMatrix[75][13] === 4);
assert(transformComponentManager.properties.localMatrix[3300][14] === 6);