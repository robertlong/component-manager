const assert = require("assert");

function benchmark(description, fn) {
  const startHeap = process.memoryUsage().heapUsed;
  const start = Date.now();
  fn();
  const elapsed = Date.now() - start;
  const totalHeapUsed = process.memoryUsage().heapUsed - startHeap;
  console.log(`${description} took ${elapsed}ms ${totalHeapUsed} heap used`);
}

class ArrayManager {
  constructor(initialSize) {
    this.entityIndices = new Map();
    this.components = Array.from({ length: initialSize}, () => ({
      localMatrix: new Float32Array(16),
      worldMatrix: new Float32Array(16),
      parent: 0,
      firstChild: 0,
      nextSibling: 0,
      prevSibling: 0,
      entity: 0
    }));

    this.count = 0;

    this.defaults = {
      localMatrix: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]),
      worldMatrix: new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]),
      parent: -1,
      firstChild: -1,
      nextSibling: -1,
      prevSibling: -1
    }
  }

  add(entityId) {
    const index = this.count++;
    this.entityIndices[entityId] = index;
    const component = this.components[entityId];
    const defaults = this.defaults;
    component.localMatrix.set(defaults.localMatrix);
    component.worldMatrix.set(defaults.worldMatrix);
    component.parent = defaults.parent;
    component.firstChild = defaults.firstChild;
    component.nextSibling = defaults.nextSibling;
    component.prevSibling = defaults.prevSibling;
    component.entity = entityId;
  }
}

const arrayManager = new ArrayManager(100001);

benchmark("add 100,000 entities (POJOs in a pre-allocated array)", () => {
  for (var i = 0; i < 100000; i++) {
    arrayManager.add(i);
  }
});