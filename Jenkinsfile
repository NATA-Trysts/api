@Library('shared-library@master') _

def credentialsId = 'aws_credentials'
def region = 'ap-southeast-1'
def clusterName ='tryst-be-cluster'
pipeline {

    agent any

    environment {
        GIT_HASH = GIT_COMMIT.take(8)
    }

    stages {
		stage ('Install docker') {
			steps {
				script {
					sh '''
						sudo apt-get update
						sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
					'''
				}
			}
		}

        stage('Build') {
            steps {
                script {
                    // hostIP = sh (
                    //     script: """
                    //         hostname -I
                    //     """,
                    //     returnStdout: true
                    // ).trim()
					// docker network create -o "com.docker.network.bridge.host_binding_ipv4"="${hostIP}" my-network
                    // docker build --network my-network -t app .
                    sh """
                       sudo docker build -t trysts/api:$GIT_HASH .
                    """
                }
            }
        }

        stage('Push') {
            steps{
                pushImageToRepo('api',GIT_HASH)
            }
        }

        stage ('Deploy') {
            steps {
                deployImage('api',credentialsId,clusterName,region,GIT_HASH)
            }
        }
    }


}
