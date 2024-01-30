function SingletonCreator(originalClass) {
  let instance;

  return function () {
    if (!instance) {
      instance = new originalClass(...arguments);
    }
    return instance;
  };
}

module.exports = SingletonCreator;
