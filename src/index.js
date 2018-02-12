const PropSizes = {
  Int8Array: (property) => property.length,
  Uint8Array: (property) => property.length,
  Int16Array: (property) => property.length * 2,
  Uint16Array: (property) => property.length * 2,
  Int32Array: (property) => property.length * 4,
  Uint32Array: (property) => property.length * 4,
  Float32Array: (property) => property.length * 4,
  Float64Array: (property) => property.length * 8,
  Int8: () => 1,
  Uint8: () => 1,
  Int16: () => 2,
  Uint16: () => 2,
  Int32: () => 4,
  Uint32: () => 4,
  Float32: () => 4,
  Float64: () => 8,
  Entity: () => 4,
};

const PropTypedArrayConstructor = {
  Int8Array: Int8Array,
  Uint8Array: Uint8Array,
  Int16Array: Int16Array,
  Uint16Array: Uint16Array,
  Int32Array: Int32Array,
  Uint32Array: Uint32Array,
  Float32Array: Float32Array,
  Float64Array: Float64Array,
  Int8: Int8Array,
  Uint8: Uint8Array,
  Int16: Int16Array,
  Uint16: Uint16Array,
  Int32: Int32Array,
  Uint32: Uint32Array,
  Float32: Float32Array,
  Float64: Float64Array,
  Entity: Int32Array,
};

function getPropertySize(property) {
  return PropSizes[property.type](property);
}

function getInstanceByteLength(schema) {
  return schema.properties.reduce((v, p) => v += getPropertySize(p), 0);
}

function createPropertyTypedArrays(schema, buffer, initialSize, instanceByteLength) {
  const properties = {};
  let offset = 0;

  for (let property of schema.properties) {
    const ArrayConstructor = PropTypedArrayConstructor[property.type];
    const length = property.length === undefined ? 1 : property.length;

    if (property.type === "Entity") {
      properties.entity = Array.from({ length: initialSize }, (_, i) => {
        return new ArrayConstructor(buffer, (instanceByteLength * i) + offset, length);
      });
    } else if (property.name !== undefined) {
      properties[property.name] = Array.from({ length: initialSize }, (_, i) => {
        return new ArrayConstructor(buffer, (instanceByteLength * i) + offset, length);
      });
    } else {
      throw new Error(`Property name not set im ${schema.name}.`);
    }

    offset += getPropertySize(property);
  }

  return properties;
}

function setPropertyDefaults(schema, properties) {
  for (let property of schema.properties) {
    switch(property.type) {
      case "Int8Array":
      case "Uint8Array":
      case "Int16Array":
      case "Uint16Array":
      case "Int32Array":
      case "Uint32Array":
      case "Float32Array":
      case "Float64Array":
        if (property.default !== undefined) {
          properties[property.name][0].set(property.default);
        }
        break;
      case "Int8":
      case "Uint8":
      case "Int16":
      case "Uint16":
      case "Int32":
      case "Uint32":
      case "Float32":
      case "Float64":
        if (property.default !== undefined) {
          properties[property.name][0][0] = property.default;
        }
        break;
      case "Entity":
        properties.entity[0] = -1;
        break;
      default:
        throw new Error(`Undefined property type: ${property.type}`);
    }      
  }
}

function createComponentInstanceClass(schema, propertyTypedArrays) {
  function ComponentInstance(manager, index) {
    this.manager = manager;
    this._index = index;
  }

  for (let property of schema.properties) {
    let propertyTypedArray;

    switch(property.type) {
      case "Int8Array":
      case "Uint8Array":
      case "Int16Array":
      case "Uint16Array":
      case "Int32Array":
      case "Uint32Array":
      case "Float32Array":
      case "Float64Array":
        propertyTypedArray = propertyTypedArrays[property.name];
        Object.defineProperty(ComponentInstance.prototype, property.name, {
          enumerable: true,
          get() {
            return propertyTypedArray[this._index];
          },
          set(value) {
            propertyTypedArray[this._index].set(value);
          }
        });
        break;
      case "Int8":
      case "Uint8":
      case "Int16":
      case "Uint16":
      case "Int32":
      case "Uint32":
      case "Float32":
      case "Float64":
        propertyTypedArray = propertyTypedArrays[property.name];
        Object.defineProperty(ComponentInstance.prototype, property.name, {
          enumerable: true,
          get() {
            return propertyTypedArray[this._index][0];
          },
          set(value) {
            propertyTypedArray[this._index][0] = value;
          }
        });
        break;
      case "Entity":
        propertyTypedArray = propertyTypedArrays.entity;
        Object.defineProperty(ComponentInstance.prototype, "entity", {
          enumerable: true,
          get() {
            return propertyTypedArray[this._index][0];
          }
        });
        break;
      default:
        throw new Error(`Undefined property type: ${property.type}`);
    }      
  }

  return ComponentInstance;
}

class ComponentManager {
  constructor(schema, initialSize) {
    this.instanceByteLength = getInstanceByteLength(schema);
    this.buffer = new ArrayBuffer(initialSize * this.instanceByteLength);
    this.properties = createPropertyTypedArrays(schema, this.buffer, initialSize, this.instanceByteLength);
    const ComponentInstanceClass = createComponentInstanceClass(schema, this.properties);
    this.ComponentInstanceClass = ComponentInstanceClass;
    this.instances = Array.from({ length: initialSize }, (_, i) => new ComponentInstanceClass(this, i));
    this.entityIndices = new Map();
    this.bufferByteView = new Uint8Array(this.buffer);
    setPropertyDefaults(schema, this.properties);
    this.defaultBufferView = this.bufferByteView.subarray(0, this.instanceByteLength);
    this.count = 1;
    this.capacity = initialSize;
  }

  add(entityId) {
    if (this.count === this.capacity) {
      throw new Error(`${this.constructor.name} capacity reached. Expansion unimplemented.`)
    }

    const index = this.count++;
    const byteOffset = index * this.instanceByteLength;
    this.entityIndices[entityId] = index;
    // TODO: Why is .copyWithin so much slower than this?
    this.bufferByteView.set(this.defaultBufferView, byteOffset);
    this.properties.entity[index][0] = entityId;

    return this.instances[index];
  }

  remove(entityId) {
    const index = this.entityIndices[entityId];

    if (index === undefined) {
      return false;
    }

    this.entityIndices.delete(entityId);

    const lastIndex = this.count - 1;

    if (this.count > 2 && index !== lastIndex) {
      const instance = this.instances[index];
      const replacementInstance = this.instances[lastIndex];

      instance.index = lastIndex;
      replacementInstance.index = index;

      this.instances[index] = replacementInstance;
      this.instances[lastIndex] = instance;

      const replacementEntity = this.properties.entity[lastIndex][0];
      this.entityIndices[replacementEntity] = index;

      const byteOffset = index * this.instanceByteLength;
      const replacementOffset = lastIndex * this.instanceByteLength;
      this.bufferByteView.set(this.defaultBufferView.subarray(replacementOffset, replacementOffset + this.instanceByteLength), byteOffset);
    }

    this.count--;

    return true;
  }
}

module.exports = ComponentManager;
