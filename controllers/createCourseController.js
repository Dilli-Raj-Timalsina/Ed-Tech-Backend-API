const catchAsync = require("../errors/catchAsync");

const s3 = require("../awsConfig/credential");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const prisma = require("./../prisma/prismaClientExport");

const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { createBucket } = require("../awsConfig/bucketControl");

const returnInputAccMimetype = (file, bucketName, key) => {
    const { mimetype } = file;

    if (mimetype == "video/mp4") {
        return {
            Bucket: bucketName,
            Key: key,
            Body: file.buffer,
            ContentType: "video/mp4",
            ContentDisposition: "inline",
            CacheControl: "max-age=3153600, public",
        };
    } else {
        return {
            Bucket: bucketName,
            Key: key,
            Body: file.buffer,
        };
    }
};

//return true if there is content with chapterName exist
// const doesExist = async (bucketName, chapterName) => {
//     return !!(await Course.findOne({
//         bucketName: bucketName,
//         "content.chapterName": chapterName,
//     }));
// };
// const doesExist = async (bucketName, chapterName) => {
//     return !!(await prisma.course.findFirst({
//         where: {
//             bucketName: bucketName,
//             include: {
//                 content: {
//                     where: {
//                         chapterName: chapterName,
//                     },
//                 },
//             },
//         },
//     }));
// };
//0:) Add remaining files to the folder:

//2:) Uploads multiple files to the specified folder in the corresponding bucket/course
const uploadChapter = catchAsync(async (req, res, next) => {
    // database work:

    //extract all data field related to folder/folderSchema
    let { chapterName, chapterTitle, courseId } = req.body;

    let videoTitles = [];
    let pdfFileTitles = [];
    let videoLinks = [];
    let pdfLinks = [];

    //extract and fill videotitle,videolinks,pdftitle, pdflink and isFree from req.files,
    //It helps to keep reference of s3 object in database for future query
    req.files.forEach((file) => {
        if (file.mimetype == "video/mp4") {
            //add video titles
            videoTitles.push(file.originalname);
            //add video links/keys:
            videoLinks.push(
                `${chapterName}/${Date.now()}-${file.originalname}`
            );
        } else {
            pdfFileTitles.push(file.originalname);
            pdfLinks.push(`${chapterName}/${Date.now()}-${file.originalname}`);
        }
    });

    const createdCourse = await prisma.chapter.create({
        data: {
            chapterName: chapterName,
            chapterTitle: chapterTitle,
            videoTitles: videoTitles,
            pdfFileTitles: pdfFileTitles,
            videoLinks: videoLinks,
            pdfLinks: pdfLinks,
        },
    });

    await prisma.course.update({
        where: { id: courseId },
        data: {
            content: {
                connect: { id: createdCourse.id },
            },
        },
    });

    // cloud work:
    let i = 0,
        j = 0;
    const inputs = req.files.map((file) => {
        if (file.mimetype == "video/mp4") {
            i++;
            return returnInputAccMimetype(file, courseId, videoLinks[i - 1]);
        } else {
            j++;
            return returnInputAccMimetype(file, courseId, pdfLinks[j - 1]);
        }
    });

    //upload all files
    await Promise.all(
        inputs.map((input) => s3.send(new PutObjectCommand(input)))
    );

    res.status(200).json({
        status: "Success",
        createdCourse,
    });
});

//3:) create brand new course:
const createNewCourse = catchAsync(async (req, res, next) => {
    //database work:

    const teacherID = req.user.id;
    // create new course in database with thumbnail reference to s3
    const thumbNailKey = `${Date.now()}-${req.file.originalname}`;

    const newCourse = await prisma.course.create({
        data: {
            ...req.body,
            price: req.body.price * 1,
            thumbNail: "",
            tutorName: req.user.name,
            duration: req.body.duration * 1,
            reviewScore: 2.0,
            isFree: req.body.isFree == "false" ? false : true,
        },
    });

    // connect userIds and CourseId
    await prisma.user.update({
        where: { id: teacherID },
        data: {
            courses: {
                connect: {
                    id: newCourse.id,
                },
            },
        },
    });

    //get signedurl which has infinite expiry date for storing thumnail
    const input = {
        Bucket: newCourse.id,
        Key: `${thumbNailKey}`,
    };
    const command1 = new GetObjectCommand(input);
    const url = await getSignedUrl(s3, command1, {});

    //update the thumbnail
    await prisma.course.update({
        where: {
            id: newCourse.id,
        },
        data: {
            thumbNail: url,
        },
    });

    // cloud work:
    // create a new course bucket
    await createBucket({ Bucket: newCourse.id });

    // upload thumbnail in s3
    const command = new PutObjectCommand({
        Bucket: newCourse.id,
        Key: thumbNailKey,
        Body: req.file.buffer,
    });
    await s3.send(command);

    res.status(200).json({
        status: "success",
        newCourse,
    });
});

module.exports = {
    createNewCourse,
    uploadChapter,
};
