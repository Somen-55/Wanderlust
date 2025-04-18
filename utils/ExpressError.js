class ExpressError extends Error {
    constructor(statusCode,mrssage){
        super();
        this.statusCode=statusCode;
        this.message=this.message;
    }
}

module.exports=ExpressError;