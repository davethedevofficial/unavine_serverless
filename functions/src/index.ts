import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
admin.initializeApp(functions.config().firebase);
import Mux from "@mux/mux-node";

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
const TOKEN = "66364cd5-1298-44cd-a465-fd5288d11e4a";
const SECRET = "via8SbRxtRsTam4YnhqJDxbPbPHRtPtW7Myocwsyy" +
                "ZVIFDy4s9rkeoaE6Btl0zEyKZYATremMMf";
const {Video} = new Mux(TOKEN, SECRET);

export const createVideo = functions.firestore
    .document("users/{userId}/videos/{videoId}")
    .onCreate(async (snap, context) => {
      const userId = context.params.userId;
      const videoId = context.params.videoId;
      // If we set `/users/marie/incoming_messages/134` to {body: "Hello"} then
      // context.params.userId == "marie";
      // context.params.videoId == "incoming_messages";
      // context.params.messageId == "134";
      // ... and ...
      // snap.data() == {body: "Hello"}

      // Create a new upload using the Mux SDK.
      const upload = await Video.Uploads.create({
        // Set the CORS origin to your application.
        cors_origin: "*",
        // "https://cloudfunctions.net",

        // Specify the settings used to create the new Asset after
        // the upload is complete
        new_asset_settings: {
          passthrough: `users/${userId}/videos/${videoId}`,
          playback_policy: "public",
          mp4_support: "standard",
        },
      });

      await snap.ref.set({
        uploadId: upload.id,
        uploadUrl: upload.url,
        status: "waiting_for_upload",
      }, {merge: true});
    });

export const testVideoUploadPhaseOne = functions.https
    .onRequest(async (request, response) => {
      const ref = await admin.firestore()
          .collection("users/WgnzTZ8ydnZPmAFOzp0S1X9oAG03/videos")
          .add({
            question: "test",
            status: "new",
          });
      // functions.logger.info("Hello logs!", request.body);
      response.send(ref.id);
    });

export const muxWebhook = functions.https
    .onRequest(async (request, response) => {
      functions.logger.info("REQUEST!", request);

      try {
        switch (request.body.type) {
          case "video.asset.created": {
            const parts = `${request.body.data.passthrough}`.split("/");
            const ref = await admin.firestore()
                .collection(parts[0])
                .doc(parts[1]).collection(parts[2]).doc(parts[3]);

            const doc = (await ref.get())?.data();
            if (doc && doc["status"] !== "ready") {
              await ref.set({
                muxAssetId: request.body.data.id,
                status: request.body.data.status,
                // asset: request.body.data,
              }, {merge: true});
            }
            break;
          };
          case "video.asset.ready": {
            const parts = `${request.body.data.passthrough}`.split("/");
            const ref = await admin.firestore()
                .collection(parts[0])
                .doc(parts[1]).collection(parts[2]).doc(parts[3]);
            await ref.set({
              muxAssetId: request.body.data.id,
              playbackId: request.body.data.playback_ids[0]["id"],
              videoURL: "https://stream.mux.com/" +
              `${request.body.data.playback_ids[0]["id"]}.m3u8`,
              status: request.body.data.status,
            //   asset: request.body.data,
            }, {merge: true});
            break;
          };
            //   case "video.asset.static_renditions.ready": {
            //     const parts = `${request.body.data.passthrough}`.split("/");
            //     const ref = await admin.firestore()
            //         .collection(parts[0])
            //         .doc(parts[1]).collection(parts[2]).doc(parts[3]);
            //     await ref.set({
            //       platbackId: request.body.data.playback_ids[0]['id'],
            //       status: request.body.data.status,
            //     //   asset: request.body.data,
            //     }, {merge: true});
            //     break;
            //   };
            // case "video.upload.cancelled": {
            //   ref.set({
            //     videoUrl: request.body.data.url,
            //     status: "cancelled_upload",
            //     asset: request.body.data,
            //   });
            // }
          default:
            functions.logger.info("some other event!", request.body);
        }

        functions.logger.info(request.body.type + "!", request.body);
        response.send(request.body.type);
        return;
      } catch (error) {
        functions.logger.info(request.body.type + "!", request.body);
        functions.logger.info("ERROR!", error);
        response.send(request.body);
        response.send(request.body.data);
        return;
      }
    });


// module.exports = async (req, res) => {
//     // We'll grab the request body again, this time grabbing the event
//     // type and event data so we can easily use it.
//     const { type: eventType, data: eventData } = await json(req);

//     switch (eventType) {
//       case 'video.asset.created': {
//         // This means an Asset was successfully created! We'll get
//         // the existing item from the DB first, then update it with the
//         // new Asset details
//         const item = await db.get(eventData.passthrough);
//         // Just in case the events got here out of order, make sure the
//         // asset isn't already set to ready before blindly updating it!
//         if (item.asset.status !== 'ready') {
//           await db.put(item.id, {
//             ...item,
//             asset: eventData,
//           });
//         }
//         break;
//       };
//       case 'video.asset.ready': {
//         // This means an Asset was successfully created! This is the final
//         // state of an Asset in this stage of its lifecycle, so we don't need
//         // to check anything first.
//           const item = await db.get(eventData.passthrough);
//         await db.put(item.id, {
//           ...item,
//           asset: eventData,
//           });
//         break;
//       };
//       case 'video.upload.cancelled': {
//         // This fires when you decide you
//          //want to cancel an upload, so you
//         // may want to update your internal
//          //state to reflect that it's no longer
//         // active.
//         const item = await db.findByUploadId(eventData.passthrough);
//         await db.put(item.id, { ...item, status: 'cancelled_upload' });
//       }
//       default:
//         // Mux sends webhooks for *lots*
//      // of things, but we'll ignore those for now
//         console.log('some other event!', eventType, eventData);
//     }

//     // Now send back that ID and the upload URL so the client can use it!
//     send(res, 200, 'Thanks for the webhook, Mux!');
// }
