import express from "express";

const router = express.Router();

router.all("/intelligence", (req, res) => {
  res.status(501).json({
    success: false,
    error: "not_implemented",
    message: "Intelligence API is not implemented yet."
  });
});

export default router;
