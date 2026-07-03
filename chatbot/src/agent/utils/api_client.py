import logging
import os
import requests
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Base API URL from environment variables
API_URL = os.getenv("API_URL", "http://localhost:8000/api")

def get_user_by_channel(channel: str, channel_user_id: str) -> Optional[Dict[str, Any]]:
    """Calls GET /api/users/by-channel to fetch user registration status.
    
    Args:
        channel: The communication channel (telegram, whatsapp, cli).
        channel_user_id: The specific user identifier on that channel.
    """
    url = f"{API_URL}/users/by-channel"
    params = {"channel": channel, "channel_user_id": str(channel_user_id)}
    
    logger.info(f"API Client: GET request to {url} with params {params}")
    try:
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            # If the user is not found, the endpoint returns null (which parses as None)
            return data
        elif response.status_code == 404:
            return None
        else:
            logger.error(f"API error: status code {response.status_code} | response: {response.text}")
            return None
    except Exception as e:
        logger.error(f"API request failed: {str(e)}")
        return None

def register_user(channel: str, channel_user_id: str, name: str, company: str, phone: Optional[str] = None) -> Dict[str, Any]:
    """Calls POST /api/users to register a new user in the system database.
    
    Args:
        channel: The channel from which the user is interacting.
        channel_user_id: The platform user identifier.
        name: The full name of the user.
        company: The name of the company/business.
        phone: The user's physical phone number (optional).
    """
    url = f"{API_URL}/users"
    payload = {
        "name": name,
        "channel": channel,
        "channel_user_id": str(channel_user_id),
        "phone": phone,
        "company_name": company
    }
    
    logger.info(f"API Client: POST request to {url} with payload {payload}")
    try:
        response = requests.post(url, json=payload, timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"API registration request failed: {str(e)}")
        # Return a dictionary mimicking success structure but indicating error for fallback
        return {
            "name": name,
            "company_name": company,
            "channel": channel,
            "channel_user_id": channel_user_id,
            "error": str(e)
        }

def validate_partner(company_name: str) -> bool:
    """Calls GET /api/partners/validate to verify if a business is a registered partner.
    
    Args:
        company_name: The company or business name to validate.
    """
    url = f"{API_URL}/partners/validate"
    params = {"company": company_name}
    
    logger.info(f"API Client: GET request to {url} with params {params}")
    try:
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return data.get("is_partner", False)
        return False
    except Exception as e:
        logger.error(f"API partner validation request failed: {str(e)}")
        return False

def list_campaigns() -> List[Dict[str, Any]]:
    """Calls GET /api/campaigns to retrieve a list of active marketing/operational campaigns."""
    url = f"{API_URL}/campaigns"
    
    logger.info(f"API Client: GET request to {url}")
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return response.json()
        return []
    except Exception as e:
        logger.error(f"API campaigns listing request failed: {str(e)}")
        return []

def escalate_to_human(channel: str, channel_user_id: str) -> bool:
    """Calls POST /api/users/escalate to request human support handover.
    
    Args:
        channel: The channel from which the user is interacting.
        channel_user_id: The platform user identifier.
    """
    url = f"{API_URL}/users/escalate"
    payload = {
        "channel": channel,
        "channel_user_id": str(channel_user_id)
    }
    
    logger.info(f"API Client: POST request to {url} with payload {payload}")
    try:
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 200:
            return True
        return False
    except Exception as e:
        logger.error(f"API escalate request failed: {str(e)}")
        return False

def check_campaign_participation(channel: str, channel_user_id: str, campaign_id: int) -> Optional[Dict[str, Any]]:
    """Calls GET /api/campaigns/participation to check if user already participates in a campaign.
    
    Args:
        channel: The communication channel (telegram, whatsapp, cli).
        channel_user_id: The specific user identifier.
        campaign_id: The campaign ID to check.
    """
    url = f"{API_URL}/campaigns/participation"
    params = {
        "channel": channel,
        "channel_user_id": str(channel_user_id),
        "campaign_id": campaign_id
    }
    
    logger.info(f"API Client: GET request to {url} with params {params}")
    try:
        response = requests.get(url, params=params, timeout=5)
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        logger.error(f"API campaign participation status request failed: {str(e)}")
        return None

def register_campaign_participation(channel: str, channel_user_id: str, campaign_id: int, extra_data: dict) -> bool:
    """Calls POST /api/campaigns/participate to link a user to a campaign with custom JSON data.
    
    Args:
        channel: The communication channel.
        channel_user_id: The specific user identifier.
        campaign_id: The campaign ID to participate in.
        extra_data: Custom payload JSON.
    """
    url = f"{API_URL}/campaigns/participate"
    payload = {
        "channel": channel,
        "channel_user_id": str(channel_user_id),
        "campaign_id": campaign_id,
        "extra_data": extra_data
    }
    
    logger.info(f"API Client: POST request to {url} with payload {payload}")
    try:
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code in (200, 201):
            return True
        return False
    except Exception as e:
        logger.error(f"API register campaign participation request failed: {str(e)}")
        return False

def link_admin_user(channel: str, channel_user_id: str, email: str) -> Dict[str, Any]:
    """Calls POST /api/users/link-admin to link a chatbot user with an admin system user.
    
    Args:
        channel: The communication channel (telegram).
        channel_user_id: The specific user identifier on that channel.
        email: The admin user's registered email in the system.
    """
    url = f"{API_URL}/users/link-admin"
    payload = {
        "channel": channel,
        "channel_user_id": str(channel_user_id),
        "email": email
    }
    
    logger.info(f"API Client: POST request to {url} with payload {payload}")
    try:
        response = requests.post(url, json=payload, timeout=5)
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"API link-admin error: status code {response.status_code} | response: {response.text}")
            try:
                err_detail = response.json().get("detail", "Error en el servidor central.")
            except Exception:
                err_detail = response.text
            return {"error": err_detail}
    except Exception as e:
        logger.error(f"API link-admin request failed: {str(e)}")
        return {"error": f"Fallo de conexión de red: {str(e)}"}


