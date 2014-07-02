define([
	"dcl/dcl",
    "./load-css!./simple3"
], function(dcl){
		return dcl(null, {
			constructor: function(){
				console.log("MyModule ctor");
				var elt = document.createElement("div");
				if(elt.classList) {
					elt.classList.add("mymodule3");
				} else {
					elt.className = "mymodule3";
				}
				elt.innerHTML = "<span>Hello from myModule!!!</span>";
				document.body.appendChild(elt);
			}
		});
	}
)