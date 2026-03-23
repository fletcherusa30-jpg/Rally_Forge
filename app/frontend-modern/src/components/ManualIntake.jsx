import React, { useState } from 'react';

/**
 * ManualIntake Component
 * Allows manual entry of military service data, MOS codes, ratings, etc.
 */
export default function ManualIntake({ onSubmit, veteranId }) {
  const [formData, setFormData] = useState({
    serviceIdentity: {
      branchOfService: '',
      rank: '',
      serialNumber: '',
    },
    servicePeriods: {
      entryDate: '',
      separationDate: '',
    },
    gradeSpecialty: {
      primaryMOSOrAFSCOrRating: '',
      additionalMOSOrSpecialties: '',
    },
    dischargeCharacter: '',
  });

  const [errors, setErrors] = useState([]);

  const branches = ['Army', 'Navy', 'Air Force', 'Marine Corps', 'Coast Guard', 'Space Force'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    const parts = name.split('.');

    if (parts.length === 1) {
      setFormData({ ...formData, [name]: value });
    } else {
      const [section, field] = parts;
      setFormData({
        ...formData,
        [section]: {
          ...formData[section],
          [field]: value,
        },
      });
    }
  };

  const validateForm = () => {
    const newErrors = [];

    if (!formData.serviceIdentity.branchOfService) newErrors.push('Branch of service is required');
    if (!formData.servicePeriods.entryDate) newErrors.push('Entry date is required');
    if (!formData.gradeSpecialty.primaryMOSOrAFSCOrRating) newErrors.push('MOS/AFSC/Rating code is required');
    if (!formData.dischargeCharacter) newErrors.push('Discharge character is required');

    if (formData.servicePeriods.entryDate && formData.servicePeriods.separationDate) {
      if (new Date(formData.servicePeriods.entryDate) > new Date(formData.servicePeriods.separationDate)) {
        newErrors.push('Separation date must be after entry date');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (validateForm()) {
      onSubmit?.({
        veteranId,
        ...formData,
      });
      setFormData({
        serviceIdentity: {
          branchOfService: '',
          rank: '',
          serialNumber: '',
        },
        servicePeriods: {
          entryDate: '',
          separationDate: '',
        },
        gradeSpecialty: {
          primaryMOSOrAFSCOrRating: '',
          additionalMOSOrSpecialties: '',
        },
        dischargeCharacter: '',
      });
    }
  };

  return (
    <div className="manual-intake-container p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6">Enter Military Service Information</h2>

      {errors.length > 0 && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="font-semibold text-red-800 mb-2">Please fix the following errors:</p>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, idx) => (
              <li key={idx}>• {error}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Service Identity Section */}
        <fieldset className="border rounded-lg p-4">
          <legend className="text-lg font-semibold px-2 mb-4">Service Identity</legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Branch of Service *</label>
              <select
                name="serviceIdentity.branchOfService"
                value={formData.serviceIdentity.branchOfService}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              >
                <option value="">Select Branch</option>
                {branches.map((branch) => (
                  <option key={branch} value={branch}>
                    {branch}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rank</label>
              <input
                type="text"
                name="serviceIdentity.rank"
                value={formData.serviceIdentity.rank}
                onChange={handleChange}
                placeholder="e.g., E-5, Captain"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Service Number/SSN</label>
              <input
                type="text"
                name="serviceIdentity.serialNumber"
                value={formData.serviceIdentity.serialNumber}
                onChange={handleChange}
                placeholder="Last 4 of SSN (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>
        </fieldset>

        {/* Service Periods Section */}
        <fieldset className="border rounded-lg p-4">
          <legend className="text-lg font-semibold px-2 mb-4">Service Period</legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Entry Date *</label>
              <input
                type="date"
                name="servicePeriods.entryDate"
                value={formData.servicePeriods.entryDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Separation Date</label>
              <input
                type="date"
                name="servicePeriods.separationDate"
                value={formData.servicePeriods.separationDate}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>
        </fieldset>

        {/* MOS/AFSC Section */}
        <fieldset className="border rounded-lg p-4">
          <legend className="text-lg font-semibold px-2 mb-4">Military Occupational Specialty</legend>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Primary MOS/AFSC/Rating *</label>
              <input
                type="text"
                name="gradeSpecialty.primaryMOSOrAFSCOrRating"
                value={formData.gradeSpecialty.primaryMOSOrAFSCOrRating}
                onChange={handleChange}
                placeholder="e.g., 11B, 3M5"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Additional MOS/AFSC Codes</label>
              <input
                type="text"
                name="gradeSpecialty.additionalMOSOrSpecialties"
                value={formData.gradeSpecialty.additionalMOSOrSpecialties}
                onChange={handleChange}
                placeholder="Comma-separated (e.g., 92Y, 51B)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
              />
            </div>
          </div>
        </fieldset>

        {/* Discharge Section */}
        <fieldset className="border rounded-lg p-4">
          <legend className="text-lg font-semibold px-2 mb-4">Discharge</legend>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Discharge Character *</label>
            <select
              name="dischargeCharacter"
              value={formData.dischargeCharacter}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
            >
              <option value="">Select Discharge Type</option>
              <option value="Honorable">Honorable</option>
              <option value="General">General</option>
              <option value="Bad Conduct">Bad Conduct</option>
              <option value="Dishonorable">Dishonorable</option>
              <option value="Other Than Honorable">Other Than Honorable</option>
            </select>
          </div>
        </fieldset>

        {/* Submit Button */}
        <div className="flex gap-4 pt-6">
          <button
            type="submit"
            className="flex-1 py-2 px-4 bg-blue-500 text-white font-semibold rounded-md hover:bg-blue-600 transition-colors"
          >
            Submit Service Information
          </button>
          <button
            type="reset"
            className="flex-1 py-2 px-4 bg-gray-200 text-gray-800 font-semibold rounded-md hover:bg-gray-300 transition-colors"
          >
            Clear Form
          </button>
        </div>
      </form>
    </div>
  );
}
