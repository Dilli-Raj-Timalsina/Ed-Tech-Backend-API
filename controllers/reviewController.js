const prisma = require("./../prisma/prismaClientExport");
const catchAsync = require("../errors/catchAsync");
const { sendMailNormal } = require("./../utils/email");
const AppError = require("../errors/appError");

const writeReview = catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const { courseId, rating, message } = req.body;

    //purchase protection
    if (!req.user.courseIds.includes(courseId)) {
        throw new AppError("please purchase the course first", 404);
    }
    const course = await prisma.course.findFirst({
        where: {
            id: courseId,
        },
    });

    //calculate average review from previous average review
    const totalStudentReview = (
        await prisma.review.findMany({
            where: {
                courseId: courseId,
            },
        })
    ).length;

    const calcReview =
        (course.reviewScore * totalStudentReview + rating) /
        (totalStudentReview + 1);
    let rounded = parseFloat(calcReview.toFixed(1));
    if (rounded > 5) {
        rounded = 5;
    }

    //update the new average review
    await prisma.course.update({
        where: {
            id: courseId,
        },
        data: {
            reviewScore: rounded,
        },
    });

    const doc = await prisma.review.create({
        data: {
            rating: rating,
            userId: userId,
            courseId: courseId,
            text: message,
        },
    });

    prisma.course.update({
        where: {
            id: courseId,
        },
        data: {
            review: {
                connect: {
                    id: doc.id,
                },
            },
        },
    });
    res.status(200).json({ status: "success", message: "review successful" });
});

const updateCart = catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const courseList = req.body.courseList;
    await prisma.user.update({
        where: { id: userId },
        data: {
            cart: courseList,
        },
    });
    res.status(200).json({
        status: "success",
        message: "succesfully updated cart",
    });
});

const getCartItems = catchAsync(async (req, res, next) => {
    const userId = req.user.id;
    const doc = await prisma.user.findFirst({
        where: {
            id: userId,
        },
    });
    res.status(200).json({
        status: "succes",
        cart: doc.cart,
    });
});

const getCartData = catchAsync(async (req, res, next) => {
    const doc = await prisma.course.findMany({
        where: {
            id: {
                in: req.body.cart,
            },
        },
    });
    const totalPrice = doc.reduce((total, course) => total + course.price, 0);

    res.status(200).json({
        status: "success",
        doc,
        totalPrice,
    });
});

const contactUs = catchAsync(async (req, res, next) => {
    //extract all user Information:
    const { name, email, subject, message, contact } = req.body;

    //d) preparing credentials to send user an email:
    const options = {
        email: email,
        subject: subject,
        message: ` 
          Name : ${name} ,
          Email :${email} ,
          contact : ${contact} ,
          message : ${message},
         `,
    };
    //e) send reset password link to the user's email
    await sendMailNormal(options);

    res.status(200).json({
        status: "success",
        message: "email sent Successfully",
        data: {
            options,
        },
    });
});

module.exports = {
    writeReview,
    getCartItems,
    updateCart,
    getCartData,
    contactUs,
};
