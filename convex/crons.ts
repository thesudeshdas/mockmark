import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.hourly(
  "expire invitations",
  { minuteUTC: 7 },
  internal.invitationEmails.expireInvitations,
  {},
);

export default crons;
