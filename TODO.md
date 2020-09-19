# TODO List

This file contains planned features & ideas.

## Endpoints
|Purpose|Endpoint  |
|--|--|
| All device states | *GET* /api/customer_app/homes/HOME_ID/states |
| Recent device events | *GET* /api/customer_app/homes/HOME_ID/events/?thing_id= |
| Camera details | *GET* /smart_cam/cameras/HOME_ID/CAMERA_THING_ID |
| Camera screenshot | *GET* /smart_cam/latest_thumbnail/CAMERA_THING_ID |
| (Dis)arm Alarm | *POST** /api/customer_app/homes/HOME_ID |


## SecuritySystem

- **Neos device type:** noon.home.alarm
- **States:** DISARMED & AWAY_ARM

\* Arm/disarm post data: { "home": { "occupied": true } }

## MotionSensor

 - **Neos device type:** neos.smartcam.motion
- **States:** True/False
## ContactSensor

 - **Neos device type:** neos.smartcam.contact
- **States:** CONTACT_DETECTED & CONTACT_NOT_DETECTED
