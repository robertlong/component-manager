const ComponentManager = require("../src");
const { mat4 } = require("gl-matrix");
const assert = require("assert");

function benchmark(description, fn) {
  const startHeap = process.memoryUsage().heapUsed;
  const start = Date.now();
  fn();
  const elapsed = Date.now() - start;
  const totalHeapUsed = process.memoryUsage().heapUsed - startHeap;
  console.log(`${description} took ${elapsed}ms ${totalHeapUsed} heap used`);
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

benchmark("add 100,000 entities", () => {
  for (var i = 0; i < 100000; i++) {
    transformComponentManager.add(i);
  }
});

assert(transformComponentManager.count === 100001);
assert(transformComponentManager.instances[1].entity === 0);

benchmark("set 100,000 localPositions", () => {
  const localMatrices = transformComponentManager.properties.localMatrix;
  const position = [8.5, 2, 3];
  for (var i = 0; i < 100000; i++) {
    localMatrices[i].set(position, 12);
  }
});

assert(transformComponentManager.properties.localMatrix[42][12] === 8.5);
assert(transformComponentManager.properties.localMatrix[75][13] === 2);
assert(transformComponentManager.properties.localMatrix[3300][14] === 3);

benchmark("multiply 100,000 matrices", () => {
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

benchmark("multiply 100,000 matrices using the component classes", () => {
  const multiply = mat4.multiply;
  const mat = mat4.create();
  mat4.fromTranslation(mat, new Float32Array([1, 2, 3]));

  let instance;

  for (var i = 0; i < 100000; i++) {
    instance = transformComponentManager.instances[i];
    multiply(instance.localMatrix, instance.localMatrix, mat);
  }
});

assert(transformComponentManager.properties.localMatrix[42][12] === 10.5);
assert(transformComponentManager.properties.localMatrix[75][13] === 6);
assert(transformComponentManager.properties.localMatrix[3300][14] === 9);

benchmark("remove 100,000 entities", () => {
  for (var i = 0; i < 100000; i++) {
    transformComponentManager.remove(i);
  }
});

assert(transformComponentManager.count === 1);
