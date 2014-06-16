define([
	"dcl/dcl",
	"./load-css!./simple.css"
], function(dcl){
		return dcl(null, {
			constructor: function(){
				console.log("MyModule ctor");
				var elt = document.createElement("div");
				if(elt.classList) {
					elt.classList.add("mymodule");
				} else {
					elt.className = "mymodule";
				}
				elt.innerHTML = "<span>Hello from myModule!!!</span>";
				document.body.appendChild(elt);
			}
		});
	}
)