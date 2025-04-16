import express from 'express'
//controllers
import {accountTypeList} from '../controllers/typeListController.js'
const router = express.Router();

//LIST CATALOGED TABLE INFO
router.get('/list',accountTypeList)


export default router;