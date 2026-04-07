export interface Employer {
  id: string;
  user_id: string;
  company_name: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  is_admin: boolean;
  is_approved: boolean;
  is_disabled: boolean;
  created_at: string;
}

export interface JobPosting {
  id: string;
  employerId: string;
  companyName: string;
  title: string;
  description: string;
  requirements: string;
  salary: string;
  jobType: 'full-time' | 'part-time' | 'contract';
  workArrangement: 'on-site' | 'remote' | 'hybrid';
  status: 'active' | 'inactive' | 'filled';
  isFeatured: boolean;
  location: {
    address: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
  };
  createdAt: string;
}

export interface Application {
  id: string;
  jobId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  resumeText: string;
  coverLetter: string;
  resumeUrl: string | null;
  coverLetterUrl: string | null;
  status: 'unread' | 'read' | 'contacted';
  rating: 'none' | 'high_potential' | 'low_potential';
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface GeneralSubmission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  looking_for: string | null;
  preferred_location: string | null;
  resume_url: string | null;
  created_at: string;
}
