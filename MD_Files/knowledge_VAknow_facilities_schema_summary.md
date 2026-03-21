# VA Facilities API — OpenAPI Schema Summary

- Title: VA Facilities
- Version: 1.0.0
- Description: ## Background

The VA Facilities API version 1 (v1) provides information about VA facilities, including locations, addresses, phone numbers, hours of operation, and available services.

VA operates several different types of facilities. This API gives information about:
- Health facilities (vha)
- Benefits facilities (vba)
- Cemeteries (nca)
- Vet Centers (vc)

## Technical Overview

Health service data for v1 of this API is based on both real-time and historical data.

- Historical data is returned for the previous 30 days. Data is based on both pending and completed appointments for a given facility.
- Service-related data may be added, removed, or modified by an authorized individual at the data facility. These data changes are available to v1 of this API in real time.


### Authentication and authorization

API requests are authorized with an API key provided in an HTTP header named apikey.

### Test data

Test data for the sandbox environment is only for testing the API and is not guaranteed to be up-to-date. After testing this API in sandbox, you can start the process of moving to production.

### Facility ID formats

A facility ID has the format prefix_stationNumber. The prefix is nca, vc, vba, or vha. Cemeteries may be VA national cemeteries or non-national; non-national cemeteries have the station number prefixed with an s. There are no other constraints on the format. Some facility ID examples are:
- Health: `vha_402GA`
- Benefits: `vba_539GB`
- National cemetery: `nca_063`
- Non-national cemetery: `nca_s1082`
- Vet Center: `vc_0872MVC`


### Service Ids

Services within the API are identified with a unique `serviceId` which are used by some endpoints. These identifiers will never change. To see all service ids currently active, use the `/facilities` endpoint to return a listing of all facilities in the API. The service ids can be found in the `services` section of the results


### Mobile Facilities

The mobile health facilities move regularly within a region. If a facility comes back from this API with "mobile": "true", the latitude/longitude and address could be inaccurate. To get the exact current location, please call the mobile facility number listed.

## Endpoints
- /facilities
- /facilities/{facilityId}
- /ids
- /nearby
- /facilities/{facilityId}/services/{serviceId}
- /facilities/{facilityId}/services

## Components
- Address
- Addresses
- Distance
- FacilitiesMetadata
- FacilitiesResponse
- Facility
- FacilityAttributes
- Hours
- OperatingStatus
- PageLinks
- Pagination
- Parent
- PatientSatisfaction
- Phone
- Satisfaction
- ServiceBenefitsService
- ServiceHealthService
- ServiceOtherService
- Services
- SupplementalStatus
- GenericError
- ApiError
- ErrorMessage
- FacilityReadResponse
- FacilitiesIdsResponse
- Meta
- Nearby
- NearbyAttributes
- NearbyResponse
- AppointmentPhoneNumber
- DetailedService
- DetailedServiceAddress
- DetailedServiceEmailContact
- DetailedServiceHours
- DetailedServiceLocation
- DetailedServiceResponse
- PatientWaitTime
- ServiceInfo
- DetailedServicesMetadata
- DetailedServicesResponse

