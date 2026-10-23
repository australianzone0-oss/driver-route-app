export type LatLng = { lat: number; lng: number };

export type StopType = "pickup" | "dropoff";

export type Stop = {
  id: string;
  jobId: string;
  type: StopType;
  address: string;
  location: LatLng;
  status: "pending" | "done";
  completedAt?: string;
  receivedBy?: string;
  photo?: string; // data URL, demo only
  signature?: string; // data URL, demo only
};

export type JobStatus = "pending" | "in_progress" | "completed";

export type Attachment = {
  name: string;
  type: string;
  size: number;
};

export type Job = {
  id: string;
  reference?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  notifyOnComplete: boolean;
  notes?: string;
  driverId: string;
  createdBy: "driver" | "office";
  createdAt: string;
  status: JobStatus;
  stops: Stop[]; // optional pickup, then one drop-off
  attachments: Attachment[];
  notices: Notice[];
};

export type Notice = {
  channel: "email" | "sms";
  to: string;
  sentAt: string;
  demo: boolean;
  ok: boolean;
  error?: string;
};

export type Vehicle = {
  id: string;
  rego: string;
  description: string | null;
  vehicleType: string | null;
  capacity: string | null;
  notes: string | null;
  active: boolean;
};

export type Driver = {
  id: string;
  name: string;
  phone: string;
  licenceNumber: string | null;
  vehicleId: string | null;
  active: boolean;
};

export type Me = {
  id: string;
  name: string;
  role: "admin" | "driver";
  email: string | null;
  phone: string | null;
  vehicle: Vehicle | null;
  company: { name: string; slug: string };
};
