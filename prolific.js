var Prolific = (function () {
	
	var each = function (obj, fn) {
		var k;
		for (k in obj) {
			if (obj.hasOwnProperty(k) && fn.call(obj, k, obj[k]) === false) {
				break;
			}
		}
		return obj;
	};
	
	var slice = function (arr, start, length) {
		return Array.prototype.slice.call(arr, start, length);
	};

	var augment = function (obj) {
		each(slice(arguments, 1), function (i, arg) {
			var k;
			for (k in arg) {
				if (!obj.hasOwnProperty(k) && arg.hasOwnProperty(k)) {
					obj[k] = arg[k];
				}
			}
		});
		return obj;
	};
	
	var deepAugment = function (obj) {
		each(slice(arguments, 1), function (i, arg) {
			each(arg, function (k, member) {
				if (!obj.hasOwnProperty(k) && arg.hasOwnProperty(k)) {
					if (typeof member === 'object' && typeof obj[k] === 'object') {
						override(obj[k], member, true);
					} else {
						obj[k] = member;
					}
				}
			});
		});
		return obj;
	};

	var override = function (obj) {
		each(slice(arguments, 1), function (i, arg) {
			var k;
			for (k in arg) {
				if (arg.hasOwnProperty(k)) {
					obj[k] = arg[k];
				}
			}
		});
		return obj;
	};
	
	var deepOverride = function (obj) {
		each(slice(arguments, 1), function (i, arg) {
			each(arg, function (k, member) {
				if (arg.hasOwnProperty(k)) {
					if (typeof member === 'object' && typeof obj[k] === 'object') {
						override(obj[k], member, true);
					} else {
						obj[k] = member;
					}
				}
			});
		});
		return obj;
	};
	
	var beget = function (obj, membs) {
		var F = function () {
			augment(this, membs);
		};
		F.prototype = obj;
		return new F();
	};
	
	var path = function (obj, str, delim) {
		var spl = str.split(delim || '.'),
			obj = obj;
		try {
			each(spl, function (i, v) {
				obj = obj[v];
			});
		} catch (e) {
			obj = undefined;
		}
		return obj;
	};
	
	var arr = function (argumentsObject) {
		return slice(argumentsObject, 0);
	};
	
	var curry = function (fn) {
		var args = slice(arguments, 1);
		return function () {
			return fn.apply(this, args.concat(slice(arguments, 0)));
		};
	};
	
	var scurry = function (fn, specs) {
		return function (moreSpecs) {
			return fn.apply(override(specs, moreSpecs));
		};
	};
	
	var extend = function (obj, name, mod) {
		if (typeof name === 'object') {
			each(name, ProxyMethod(obj, method(extend)));
		} else {
			obj[name] = new Module(mod);
		}
		return obj;
	};
	
	var map = function (obj, fn) {
		var arr = obj.slice === Array.prototype.slice? []: {};
		each(obj, function (k, v) {
			arr[k] = fn.apply(this, arguments);
		});
		return arr;
	};
	
	var method = function (fn) {
		return function () {
			var args = [this].concat(slice(arguments, 0));
			return fn.apply(this, args);
		};
	};
	
	var ProxyMethod = function (context, fn) {
		return function () {
			return fn.apply(context, arguments);
		};
	};
	
	var DynamicProxyMethod = function (getContext, fn) {
		return function () {
			return fn.apply(getContext(), arguments);
		};
	};
	
	var WrapperMethod = function (orig, closure) {
		return closure(orig);
	};
	
	var Module = function (fn) {
		var self = new Base();
		return augment(self, fn.call(self, self));
	};
	
	var Chain = function () {
		var fns = [],
			proto = Array.prototype;
		return {
			push: ProxyMethod(fns, proto.push),
			remove: function (i) {
				fns.splice(i, 1);
				return this;
			},
			run: function (data) {
				var i,
					result,
					fn;
				for (i = fns.length - 1; i >= 0; i -= 1) {
					fn = fns[i];
					result = fn.call(this, data);
					if (fn.once) {
						this.remove(i);
					}
					if (result === false) {
						break;
					}
				}
				return this;
			}
		}
	};
	
	var Queue = function () {
		var self = new Chain();
		self.push = WrapperMethod(self.push, function (parent_push) {
			return function (fn) {
				fn.once = true;
				parent_push(fn);
				return this;
			}
		});
		return self;
	};
	
	var Base = function (membs) {
		return augment({
			augment: method(augment),
			deepAugment: method(deepAugment),
			override: method(override),
			deepOverride: method(deepOverride),
			extend: method(extend),
			each: method(each),
			map: method(map),
			beget: method(beget),
			slice: method(slice),
			path: method(path)
		}, membs);
	};
	
	var Mixable = function () {
		var self = new Base();
		return self.override({
			mix: function () {
				each(arguments, function (k, fn) {
					self.augment(fn());
				});
				return this;
			}
		});
	};
	
	var Class = function (closure) {
		var options = closure(),
			Static = { specs: options };
		
		if (options.parent && options.parent.specs && options.parent.specs.Static) {
			augment(Static, options.parent.specs.Static());
		}
		
		if (options.mix) {
			each(options.mix, function (i, fn) {
				override(Static, fn.specs && fn.specs.Static && fn.specs.Static());
			});
		}
		
		if (options.Static) {
			override(Static, options.Static());
		}
		
		return augment(function (args) {
			var args = args || {},
				specs = options.defaults? augment(args, options.defaults): args,
				base = options.parent? new options.parent(specs): {};
				
			if (options.mix) {
				each(options.mix, function (i, fn) {
					augment(base, fn.call(base, specs));
				});
			}
			
			return beget(base, options.create.call(base, specs));
			
		}, Static);
	};
	
	var Composite = function (methods, functions) {
		
		var contextualize = function (fn) {
			return function () {
				return fn.apply(this.context, arguments);
			};
		};
	
		var F = function (context) {
			this.context = context;
		};
		
		F.prototype = map(methods, function (k, fn) {
			return contextualize(fn);
		});
		
		return augment(function (context) {
			return context? new F(context): new Base();
		}, functions, {
			addMethod: function (k, method) {
				F.prototype[k] = contextualize(method);
				return this;
			},
			addMethods: function (methods) {
				each(methods, function (k, method) {
					F.prototype[k] = contextualize(method);
				});
				return this;
			}
		});
	};
	
	//Prolific can wrap things and perform methods on them as well as serve as a namespace
	return new Composite(
	
		//Wrapped methods	
		new Base(),
		
		//Static methods
		{
			ProxyMethod: ProxyMethod,
			WrapperMethod: WrapperMethod,
			Chain: Chain,
			Queue: Queue,
			Base: Base,
			App: Base,
			Mixable: Mixable,
			Class: Class,
			Module: Module,
			Composite: Composite,
			
			//Functions
			augment: augment,
			deepAugment: deepAugment,
			override: override,
			deepOverride: deepOverride,
			beget: beget,
			method: method,
			slice: slice,
			each: each,
			extend: extend,
			map: map,
			curry: curry,
			scurry: scurry,
			path: path,
			arr: arr
		}
		
	);

}());