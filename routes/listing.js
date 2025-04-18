const express=require("express");
const router=express.Router();
const wrapAsync=require("../utils/wrapAsync.js");
const { listingSchema,reviewSchema }=require("../schema.js");
const ExpressError=require("../utils/ExpressError.js");
const Listing=require("../models/listings.js");
const {isLoggedIn,isOwner}=require("../middleware.js");
const multer=require("multer");
const {storage,cloudinary}=require("../cloudconfig.js");
const upload=multer({storage});
const mbxgeocoding=require('@mapbox/mapbox-sdk/services/geocoding');
const mapToken=process.env.MAP_TOKEN;
const geocodingClient= mbxgeocoding({accessToken:mapToken});
const validateListing=(req,res,next)=>{
  let {error}=listingSchema.validate(req.body);
 
  if(error){
    let errMsg=error.details.map((el)=>el.message).join(",");
    throw new ExpressError(400,errMsg);
  }else{
    next();
  }
};

//Index Route
router.get("/", wrapAsync(async (req,res) =>{
    const allListings=await Listing.find({});
    res.render("listings/index.ejs",{allListings});
     }));
     // New route
 router.get("/new",isLoggedIn,(req,res)=> {
  console.log(req.user);
 
   res.render("listings/new.ejs");
 });
 //show route
 router.get("/:id", wrapAsync(async (req,res) => {
  let {id} = req.params;
  const listing = await Listing.findById(id).populate({ path:"reviews",populate:{ path:"author",},})
  .populate("owner");

  // FIX: if listing is not found
  if (!listing) {
   req.flash("error","Listing you requested for does not exist!");
    return res.redirect("/listings");
  }
console.log(listing);
  res.render("listings/show.ejs", { listing });
}));
 //create route
   
 router.post(
   "/",
   upload.single("listing[image]"),
   validateListing,
   isLoggedIn,
   wrapAsync(async (req, res, next) => {
    let response=await geocodingClient.forwardGeocode({
      query:req.body.listing.location,
      limit:1,
     })
     .send();
   
   
     const newListing = new Listing(req.body.listing);
     newListing.owner = req.user._id;
 
     // Image assignment to match schema
     if (req.file) {
       newListing.image = {
         url: req.file.path,          // file path from multer
         filename: req.file.filename  // file name from multer
       };
     }
     newListing.geometry=response.body.features[0].geometry;
     let saved=await newListing.save();
     console.log(saved);
     req.flash("success", "created");
     res.redirect("/listings");
   })
 );
 //Edit route
 router.get("/:id/edit",isLoggedIn,isOwner,wrapAsync(async (req,res) => {
   let {id}=req.params;
   const listing = await Listing.findById(id);
   if (!listing) {
    req.flash("error","Listing you requested for does not exist!");
     return res.redirect("/listings");
   }

let originalImageUrl = cloudinary.url(listing.image.filename, {
  width: 100,
  crop: "scale"
});
   res.render("listings/edit.ejs", {listing,originalImageUrl});
 }));
 //update Route

router.put(
  "/:id",
  isLoggedIn,
  upload.single("listing[image]"),
  validateListing,
  wrapAsync(async (req, res) => {
    let { id } = req.params;
    let listing = await Listing.findById(id);

    // Update other fields
    Object.assign(listing, req.body.listing);

    // If a new file is uploaded
    if (req.file) {
      // Delete the old image from Cloudinary
      if (listing.image && listing.image.filename) {
        await cloudinary.uploader.destroy(listing.image.filename);
      }

      // Set new image data
      listing.image = {
        url: req.file.path,
        filename: req.file.filename,
      };
    }
    await listing.save();
    req.flash("success", "Updated");
    res.redirect(`/listings/${id}`);
  })
);
 //Delete Route
 router.delete("/:id",isLoggedIn,isOwner,wrapAsync(async (req,res) => {
   let {id}=req.params;
   let deletedListing= await Listing.findByIdAndDelete(id);
   console.log(deletedListing);
   req.flash("success","Deleted");
   res.redirect("/listings");
 
 }));
 
 module.exports=router;