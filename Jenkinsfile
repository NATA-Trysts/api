@Library('shared-library')_

def credentialsId = params.AWS_CREDENTIAL_ID
// def accountID = params.AWS_ACCOUNT_ID
// def repoName = params.IMAGE_REPO_NAME
// def region = params.region
// def clusterName = params.CLUSTER_NAME

pipeline {

    agent any

    environment {
        GIT_HASH = GIT_COMMIT.take(8)
    }

    stages {
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
                        docker build -t trysts/api:$GIT_HASH .
                    """
                }
            }
        }

        stage('Push') {
            steps{
                pushImageToRepo('api',GIT_HASH)
            }
        }

        // stage ('Deploy') {
        //     steps {
        //         deployImg(credentialsId,clusterName,region,GIT_HASH)
        //     }
        // }
    }


}