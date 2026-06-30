import { Router } from "express";
import { requireUser, getUser } from "../../middleware/auth.js";
import { profileInputSchema } from "./schemas.js";
import { getMyProfile, updateMyProfile, getPublicProfile, getVCard } from "./service.js";

export const profilesRouter = Router();

profilesRouter.get("/me", requireUser, async (req, res, next) => {
  try {
    const user = getUser(req);
    const profile = await getMyProfile(user.id);
    if (!profile) {
      res.status(404).json({ ok: false, error: "Profile not found." });
      return;
    }
    res.json({ ok: true, data: profile });
  } catch (error) {
    next(error);
  }
});

profilesRouter.put("/me", requireUser, async (req, res, next) => {
  try {
    const user = getUser(req);
    const input = profileInputSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid profile details." });
      return;
    }

    const profile = await updateMyProfile(user.id, input.data);
    res.json({ ok: true, data: profile });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json({ ok: false, error: "This profile slug is already taken." });
      return;
    }
    next(error);
  }
});

profilesRouter.get("/:slug", async (req, res, next) => {
  try {
    const profile = await getPublicProfile(req.params.slug);
    if (!profile) {
      res.status(404).json({ ok: false, error: "Profile not found." });
      return;
    }
    res.json({ ok: true, data: profile });
  } catch (error) {
    next(error);
  }
});

profilesRouter.get("/:slug/vcard", async (req, res, next) => {
  try {
    const vcard = await getVCard(req.params.slug);
    if (!vcard) {
      res.status(404).json({ ok: false, error: "Profile not found." });
      return;
    }
    res
      .setHeader("Content-Type", "text/vcard; charset=utf-8")
      .setHeader("Content-Disposition", `attachment; filename="${req.params.slug}.vcf"`)
      .send(vcard);
  } catch (error) {
    next(error);
  }
});
