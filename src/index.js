const PropArrayConstructor = {
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
  Entity: Int32Array
};

/**
 * Generates a component manager from the provided schema.
 * Component data tightly packed one after another in an ArrayBuffer.
 * componentData.properties availible for component data access as arrays.
 * componentData.instances availible for component data access as objects.
 */
class ComponentManager {
  constructor(schema, initialSize) {
    // The total byte length of all the properties in a single component.
    this.instanceByteLength = schema.properties.reduce((byteLength, prop) => {
      const length = prop.length || 1;
      const arrayConstructor = PropArrayConstructor[prop.type];
      return byteLength + arrayConstructor.BYTES_PER_ELEMENT * length;
    }, 0);

    // The ArrayBuffer where all component data is stored.
    this.buffer = new ArrayBuffer(initialSize * this.instanceByteLength);

    // Used to copy component data.
    this.byteView = new Uint8Array(this.buffer);

    // The ArrayBuffer where all default component data is stored.
    this.defaultBuffer = new ArrayBuffer(this.instanceByteLength);

    // Used to copy default component data.
    this.defaultBufferView = new Uint8Array(this.defaultBuffer);

    // The current number of active components in the manager.
    this.count = 0;

    // The total number of components that can be stored before expanding the buffer.
    this.capacity = initialSize;

    // Stores arrays of TypedArrays for accessing each property. The keys are property names.
    this.properties = {};

    // Used to lookup entity indices into the property arrays.
    this.entityIndices = new Map();

    // Class constructor for an instance of a component.
    function ComponentInstance(manager, index) {
      this.manager = manager;
      this._index = index;
    }

    let propOffset = 0;

    for (let property of schema.properties) {
      const propertyType = property.type;
      const propertyName = propertyType === "Entity" ? "entity" : property.name;
      const ArrayConstructor = PropArrayConstructor[propertyType];
      const length = property.length || 1;
      const defaultValue = property.default;

      // Initialize a TypedArrayView for each component for the current property.
      const propertyTypedArray = Array.from({ length: initialSize }, (_, i) => {
        return new ArrayConstructor(this.buffer, this.instanceByteLength * i + propOffset, length);
      });

      this.properties[propertyName] = propertyTypedArray;

      if (propertyType === "Entity") {
        // Set default entity value to -1 (uninitalized).
        new ArrayConstructor(this.defaultBuffer, propOffset, length)[0] = -1;

        // Set array value property type getter (entity cannot be set on instance class).
        Object.defineProperty(ComponentInstance.prototype, propertyName, {
          enumerable: true,
          get() {
            return propertyTypedArray[this._index][0];
          }
        });
      } else if (property.length !== undefined && defaultValue !== undefined) {
        // Set the default property value.
        new ArrayConstructor(this.defaultBuffer, propOffset, length).set(defaultValue);

        // Set array value property type getter and setter.
        Object.defineProperty(ComponentInstance.prototype, propertyName, {
          enumerable: true,
          get() {
            return propertyTypedArray[this._index];
          },
          set() {
            propertyTypedArray[this._index].set(value);
          }
        });
      } else if (defaultValue !== undefined) {
        // Set the default property value.
        new ArrayConstructor(this.defaultBuffer, propOffset, length)[0] = defaultValue;

        // Set single value property type getter and setter.
        Object.defineProperty(ComponentInstance.prototype, propertyName, {
          enumerable: true,
          get() {
            return propertyTypedArray[this._index][0];
          },
          set(value) {
            propertyTypedArray[this._index][0] = value;
          }
        });
      }

      propOffset += ArrayConstructor.BYTES_PER_ELEMENT * length;
    }

    // Don't use the ComponentInstance constructor directly. Only use for checking instanceOf.
    this.ComponentInstance = ComponentInstance;

    // Array of component instances. Use entityIndices map to get index.
    this.instances = Array.from({ length: initialSize }, (_, i) => {
      return new ComponentInstance(this, i);
    });
  }

  /**
   * Adds a component to the specified entity.
   * @param {number} entityId - The id of the entity add.
   * @returns {ComponentInstance} The component instance for the added component.
   */
  add(entityId) {
    if (this.count === this.capacity) {
      throw new Error(`${this.constructor.name} capacity reached. Expansion unimplemented.`);
    }

    const index = this.count++;
    const byteOffset = index * this.instanceByteLength;
    this.entityIndices[entityId] = index;
    this.byteView.set(this.defaultBufferView, byteOffset);
    this.properties.entity[index][0] = entityId;

    return this.instances[index];
  }

  /**
   * Removes a component from the specified entity.
   * @param {number} entityId - The id of the entity to remove.
   * @returns {boolean} Returns true if removed and false if it didn't exist.
   */
  remove(entityId) {
    const index = this.entityIndices[entityId];

    if (index === undefined) {
      return false;
    }

    this.entityIndices.delete(entityId);

    const lastIndex = this.count - 1;

    if (this.count > 1 && index !== lastIndex) {
      const instance = this.instances[index];
      const replacementInstance = this.instances[lastIndex];

      instance.index = lastIndex;
      replacementInstance.index = index;

      this.instances[index] = replacementInstance;
      this.instances[lastIndex] = instance;

      const replacementEntity = this.properties.entity[lastIndex][0];
      this.entityIndices[replacementEntity] = index;

      const instanceByteLength = this.instanceByteLength;
      const byteOffset = index * instanceByteLength;
      const replacementOffset = lastIndex * instanceByteLength;
      this.byteView.set(
        this.byteView.subarray(replacementOffset, replacementOffset + instanceByteLength),
        byteOffset
      );
    }

    this.count--;

    return true;
  }
}

module.exports = ComponentManager;
