define([
	"dcl/dcl",
	"./load-css!./simple",
	"./load-css!./simple2"
], function(dcl){
		return dcl(null, {
			constructor: function(){
				console.log("MyModule ctor");
				var elt = document.createElement("div");
				if(elt.classList) {
					elt.classList.add("mymodule2");
				} else {
					elt.className = "mymodule2";
				}
				elt.innerHTML = "<span>Hello from myModule!!!</span>";
				document.body.appendChild(elt);
			}
		});
	}
)